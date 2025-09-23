class ExportHandler {
    constructor() {
        this.ffmpeg = null;
        this.isLoading = false;
        this.isReady = false;
    }

    async initialize() {
        console.log('FFmpeg initialize: Starting initialization...');
        if (this.isReady) {
            console.log('FFmpeg initialize: Already ready');
            return;
        }
        if (this.isLoading) {
            console.log('FFmpeg initialize: Already loading, waiting...');
            // Wait for existing initialization
            while (this.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }

        this.isLoading = true;
        console.log('FFmpeg initialize: Setting isLoading = true');
        try {
            console.log('FFmpeg initialize: Getting FFmpeg globals...');
            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile } = window.FFmpegUtil;
            console.log('FFmpeg initialize: FFmpeg:', !!FFmpeg, 'fetchFile:', !!fetchFile);
            
            console.log('FFmpeg initialize: Creating FFmpeg instance...');
            this.ffmpeg = new FFmpeg();
            this.ffmpeg.on('log', ({ message }) => {
                console.log('[FFmpeg]:', message);
            });

            console.log('FFmpeg initialize: Loading FFmpeg with local files...');
            
            // Try using minimal load configuration
            console.log('FFmpeg initialize: Trying minimal load configuration...');
            const loadPromise = this.ffmpeg.load();
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('FFmpeg load timeout after 30 seconds')), 30000)
            );
            
            await Promise.race([loadPromise, timeoutPromise]);
            console.log('FFmpeg initialize: FFmpeg loaded successfully');

            console.log('FFmpeg initialize: Setting fetchFile and isReady...');
            this.fetchFile = fetchFile;
            this.isReady = true;
            console.log('FFmpeg initialize: Initialization completed successfully');
        } catch (error) {
            console.error('Failed to initialize FFmpeg:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    async exportStoryAsVideo(story, profilePicBlob) {
        console.log('FFmpeg export: exportStoryAsVideo called, isReady:', this.isReady);
        
        if (!this.isReady) {
            console.log('FFmpeg export: Initializing FFmpeg...');
            await this.initialize();
            console.log('FFmpeg export: Initialization complete, isReady:', this.isReady);
        }

        try {
            console.log('FFmpeg export: Starting export for story:', story.filename);
            const isVideo = story.type === 'video';
            const inputFileName = isVideo ? 'input.mp4' : 'input.jpg';
            const outputFileName = 'output.mp4';

            // Write input media file
            console.log('FFmpeg export: Fetching media from URL:', story.url);
            
            // Convert relative URL to absolute URL for FFmpeg fetchFile
            const absoluteUrl = new URL(story.url, window.location.origin).href;
            console.log('FFmpeg export: Converted to absolute URL:', absoluteUrl);
            
            // Add timeout to the fetch operation
            const fetchPromise = this.fetchFile(absoluteUrl);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Fetch timeout after 30 seconds')), 30000)
            );
            
            const mediaData = await Promise.race([fetchPromise, timeoutPromise]);
            console.log('FFmpeg export: Media data fetched, size:', mediaData.byteLength);
            
            console.log('FFmpeg export: Writing file to FFmpeg:', inputFileName);
            await this.ffmpeg.writeFile(inputFileName, mediaData);
            console.log('FFmpeg export: File written to FFmpeg successfully');

            // Prepare overlay assets
            const overlayCanvas = await this.createOverlayCanvas(story, profilePicBlob);
            const overlayBlob = await this.canvasToBlob(overlayCanvas);
            const overlayData = await this.fetchFile(overlayBlob);
            await this.ffmpeg.writeFile('overlay.png', overlayData);

            // Build FFmpeg command
            let ffmpegCommand;
            if (isVideo) {
                // For video: overlay the PNG on top of the video
                ffmpegCommand = [
                    '-i', inputFileName,
                    '-i', 'overlay.png',
                    '-filter_complex', '[0:v][1:v]overlay=0:0',
                    '-c:a', 'copy',
                    '-preset', 'fast',
                    outputFileName
                ];
            } else {
                // For image: create a 6-second video with the overlay
                ffmpegCommand = [
                    '-loop', '1',
                    '-i', inputFileName,
                    '-i', 'overlay.png',
                    '-filter_complex', '[0:v][1:v]overlay=0:0',
                    '-t', '6',
                    '-pix_fmt', 'yuv420p',
                    '-preset', 'fast',
                    outputFileName
                ];
            }

            // Execute FFmpeg command
            await this.ffmpeg.exec(ffmpegCommand);

            // Read the output file
            const outputData = await this.ffmpeg.readFile(outputFileName);
            const outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });

            // Clean up temporary files
            await this.ffmpeg.deleteFile(inputFileName);
            await this.ffmpeg.deleteFile('overlay.png');
            await this.ffmpeg.deleteFile(outputFileName);

            return outputBlob;
        } catch (error) {
            console.error('Error exporting story:', error);
            throw error;
        }
    }

    async createOverlayCanvas(story, profilePicBlob) {
        // Create transparent overlay using the same logic as screenshot but without media background
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size to match typical Instagram story dimensions
        canvas.width = 1080;
        canvas.height = 1920;

        // Keep background fully transparent - no background drawing at all
        // Just draw the UI overlay elements exactly like the screenshot

        // Use the same overlay drawing logic from the screenshot implementation
        await this.drawOverlayForScreenshot(ctx, story, profilePicBlob);

        return canvas;
    }

    async drawOverlayForScreenshot(ctx, story, profilePicBlob) {
        const profileSize = 64;
        const profileX = 40;
        const profileY = 60;
        const username = story.username;

        if (profilePicBlob) {
            const profileImg = new Image();
            profileImg.src = URL.createObjectURL(profilePicBlob);
            await new Promise(resolve => profileImg.onload = resolve);

            // Create circular clipping path
            ctx.save();
            ctx.beginPath();
            ctx.arc(profileX + profileSize/2, profileY + profileSize/2, profileSize/2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            // Draw profile image
            ctx.drawImage(profileImg, profileX, profileY, profileSize, profileSize);
            ctx.restore();

            // Add white border around profile picture
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(profileX + profileSize/2, profileY + profileSize/2, profileSize/2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Draw placeholder circle if no profile picture
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(profileX + profileSize/2, profileY + profileSize/2, profileSize/2, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'white';
            ctx.lineWidth = 6;
            ctx.stroke();
        }

        // Draw username text using enhanced shadow method
        const textX = profileX + profileSize + 20;
        let currentY = profileY + profileSize/2;
        const usernameFont = 'bold 29px "Proxima Nova", "Helvetica Neue", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        
        this.drawTextWithShadow(ctx, username, textX, currentY, usernameFont);

        // Handle reshare info for medicalmedium
        if (story.reshareInfo && username === 'medicalmedium') {
            // Draw reshare icon
            const iconSize = 24;
            const iconX = textX;
            const iconY = currentY + 40;
            
            // Draw a simple reshare/repost icon (curved arrow)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Draw the reshare icon manually
            ctx.beginPath();
            // Main curve
            ctx.arc(iconX + iconSize/2, iconY + iconSize/2, iconSize/3, Math.PI * 0.2, Math.PI * 1.8, false);
            // Arrow head
            ctx.moveTo(iconX + iconSize/2 - iconSize/4, iconY + iconSize/4);
            ctx.lineTo(iconX + iconSize/2, iconY);
            ctx.lineTo(iconX + iconSize/2 + iconSize/4, iconY + iconSize/4);
            ctx.stroke();
            
            // Draw original username text using enhanced shadow method
            const reshareTextX = iconX + iconSize + 10;
            const reshareTextY = iconY + iconSize/2;
            const reshareFont = 'normal 24px "Proxima Nova", "Helvetica Neue", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
            
            this.drawTextWithShadow(ctx, `@${story.reshareInfo.originalUser}`, reshareTextX, reshareTextY, reshareFont, 'rgba(255, 255, 255, 0.9)');
        }

        return canvas;
    }

    async drawProgressBar(ctx, story, canvasWidth, canvasHeight) {
        // Replicate the progress bar from the story viewer
        const progressBarHeight = 3;
        const progressBarY = 20;
        const segmentSpacing = 4;
        const totalSegments = 5; // Typical story count per user
        const segmentWidth = (canvasWidth - (totalSegments - 1) * segmentSpacing - 80) / totalSegments; // 80px margin
        
        ctx.save();
        
        for (let i = 0; i < totalSegments; i++) {
            const x = 40 + i * (segmentWidth + segmentSpacing);
            
            // Background segment (unfilled)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(x, progressBarY, segmentWidth, progressBarHeight);
            
            // Fill current and completed segments
            if (i < 2) { // Simulate 2nd story being viewed
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(x, progressBarY, segmentWidth, progressBarHeight);
            }
        }
        
        ctx.restore();
    }

    drawTextWithShadow(ctx, text, x, y, font, fillStyle = 'white') {
        ctx.save();
        
        // Set font
        ctx.font = font;
        ctx.textBaseline = 'middle';
        
        // Draw multiple shadow passes for better visibility
        const shadowPasses = [
            { offsetX: 2, offsetY: 2, blur: 8, color: 'rgba(0, 0, 0, 0.8)' },
            { offsetX: 1, offsetY: 1, blur: 4, color: 'rgba(0, 0, 0, 0.6)' },
            { offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(0, 0, 0, 0.4)' }
        ];
        
        // Draw shadow passes
        shadowPasses.forEach(shadow => {
            ctx.shadowColor = shadow.color;
            ctx.shadowBlur = shadow.blur;
            ctx.shadowOffsetX = shadow.offsetX;
            ctx.shadowOffsetY = shadow.offsetY;
            ctx.fillStyle = fillStyle;
            ctx.fillText(text, x, y);
        });
        
        // Clear shadow and draw final text
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = fillStyle;
        ctx.fillText(text, x, y);
        
        ctx.restore();
    }

    canvasToBlob(canvas) {
        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), 'image/png');
        });
    }

    formatFileName(originalFilename) {
        // Remove extension and add _screencapture.mp4
        const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
        return `${nameWithoutExt}_screencapture.mp4`;
    }
    
    async concatenateVideos(videoBlobs, outputFilename) {
        if (!this.isReady) {
            await this.initialize();
        }
        
        if (videoBlobs.length === 1) {
            return videoBlobs[0];
        }
        
        try {
            // Write all input videos to FFmpeg
            const inputFiles = [];
            for (let i = 0; i < videoBlobs.length; i++) {
                const inputName = `input${i}.mp4`;
                const videoData = await this.fetchFile(videoBlobs[i]);
                await this.ffmpeg.writeFile(inputName, videoData);
                inputFiles.push(inputName);
            }
            
            // Create concat list file
            const concatList = inputFiles.map((file, i) => `file '${file}'`).join('\n');
            await this.ffmpeg.writeFile('concat_list.txt', new TextEncoder().encode(concatList));
            
            // Run FFmpeg concat command
            await this.ffmpeg.exec([
                '-f', 'concat',
                '-safe', '0',
                '-i', 'concat_list.txt',
                '-c', 'copy',
                outputFilename
            ]);
            
            // Read the output
            const outputData = await this.ffmpeg.readFile(outputFilename);
            const outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });
            
            // Clean up
            for (const file of inputFiles) {
                await this.ffmpeg.deleteFile(file);
            }
            await this.ffmpeg.deleteFile('concat_list.txt');
            await this.ffmpeg.deleteFile(outputFilename);
            
            return outputBlob;
            
        } catch (error) {
            console.error('Video concatenation failed:', error);
            throw error;
        }
    }

    async downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Export as global for use in app.js
window.ExportHandler = ExportHandler;