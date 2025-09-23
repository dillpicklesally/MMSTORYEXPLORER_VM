class ExportHandler {
    constructor() {
        this.ffmpeg = null;
        this.isLoading = false;
        this.isReady = false;
    }

    async initialize() {
        if (this.isReady) return;
        if (this.isLoading) {
            // Wait for existing initialization
            while (this.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }

        this.isLoading = true;
        try {
            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile } = window.FFmpegUtil;
            
            this.ffmpeg = new FFmpeg();
            this.ffmpeg.on('log', ({ message }) => {
                console.log('[FFmpeg]:', message);
            });

            // Use CDN for FFmpeg core files (they work reliably)
            await this.ffmpeg.load({
                coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
                wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
                // Worker URL is optional and handled internally by FFmpeg
            });
            console.log('FFmpeg loaded successfully');

            this.fetchFile = fetchFile;
            this.isReady = true;
        } catch (error) {
            console.error('Failed to initialize FFmpeg:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    async exportStoryAsVideo(story, profilePicBlob) {
        if (!this.isReady) {
            await this.initialize();
        }

        try {
            const isVideo = story.type === 'video';
            const inputFileName = isVideo ? 'input.mp4' : 'input.jpg';
            const outputFileName = 'output.mp4';

            // Write input media file
            const mediaData = await this.fetchFile(story.url);
            await this.ffmpeg.writeFile(inputFileName, mediaData);

            // Create transparent overlay PNG using screenshot logic (without background media)
            const overlayCanvas = await this.createTransparentOverlay(story, profilePicBlob);
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
                    '-filter_complex', '[0:v][1:v]scale2ref[overlay][base];[base][overlay]overlay=0:0',
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
                    '-filter_complex', '[0:v][1:v]scale2ref[overlay][base];[base][overlay]overlay=0:0',
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

    async createTransparentOverlay(story, profilePicBlob) {
        // Create transparent overlay using the exact screenshot logic but without media background
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size to match typical Instagram story dimensions
        canvas.width = 1080;
        canvas.height = 1920;

        // Keep background fully transparent - no background drawing at all
        // Just draw the UI overlay elements exactly like the screenshot

        // Use the exact overlay drawing logic from the screenshot implementation
        await this.drawOverlayForScreenshot(ctx, story, profilePicBlob);

        return canvas;
    }

    async drawOverlayForScreenshot(ctx, story, profilePicBlob) {
        const profileSize = 64;
        const profileX = 40;
        const profileY = 30;
        const username = story.username;

        // Draw profile picture with circle mask (exact copy from app.js screenshot)
        if (profilePicBlob) {
            try {
                const profileImg = new Image();
                profileImg.src = URL.createObjectURL(profilePicBlob);
                let imageLoaded = false;
                
                await new Promise((resolve, reject) => {
                    profileImg.onload = () => {
                        imageLoaded = true;
                        resolve();
                    };
                    profileImg.onerror = (error) => {
                        console.warn('Failed to load profile image for screenshot overlay:', error);
                        resolve(); // Continue without profile image
                    };
                });

                // Only draw if image actually loaded
                if (imageLoaded && profileImg.complete && profileImg.naturalWidth > 0) {
                    // Create circular clipping path
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(profileX + profileSize/2, profileY + profileSize/2, profileSize/2, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();

                    // Draw profile image
                    ctx.drawImage(profileImg, profileX, profileY, profileSize, profileSize);
                    ctx.restore();

                    // No border around profile picture (Instagram style)
                } else {
                    // Draw placeholder circle if profile image failed to load
                    ctx.fillStyle = '#333';
                    ctx.beginPath();
                    ctx.arc(profileX + profileSize/2, profileY + profileSize/2, profileSize/2, 0, Math.PI * 2);
                    ctx.fill();

                    // No border on placeholder circle
                }
            } catch (error) {
                console.warn('Error processing profile image for screenshot:', error);
                // Draw placeholder circle on any error
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.arc(profileX + profileSize/2, profileY + profileSize/2, profileSize/2, 0, Math.PI * 2);
                ctx.fill();

                // No border on error placeholder circle
            }
        } else {
            // Draw placeholder circle if no profile picture
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(profileX + profileSize/2, profileY + profileSize/2, profileSize/2, 0, Math.PI * 2);
            ctx.fill();

            // No border on placeholder circle when no profile picture
        }

        // Set up subtle text shadow like Instagram
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        // Draw username text with Instagram-like font
        ctx.font = 'bold 36px "Proxima Nova", "Helvetica Neue", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'middle';
        
        const textX = profileX + profileSize + 20;
        let currentY = profileY + profileSize/2;
        
        ctx.fillText(username, textX, currentY);

        // Handle reshare info for medicalmedium
        if (story.reshareInfo && username === 'medicalmedium') {
            // Draw reshare icon (exact copy from app.js)
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
            
            // Draw original username text
            ctx.font = 'normal 30px "Proxima Nova", "Helvetica Neue", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.textBaseline = 'middle';
            
            const reshareTextX = iconX + iconSize + 10;
            const reshareTextY = iconY + iconSize/2;
            
            ctx.fillText(`@${story.reshareInfo.originalUser}`, reshareTextX, reshareTextY);
        }
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    canvasToBlob(canvas) {
        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), 'image/png');
        });
    }

    formatFileName(originalFilename, displayDate = null) {
        // If display date is provided, use it instead of the filename date
        if (displayDate) {
            const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
            const parts = nameWithoutExt.split('_');
            
            if (parts.length >= 4 && parts[1] === 'story') {
                // Replace the date part with display date
                parts[2] = displayDate;
                return `${parts.join('_')}_screencapture.mp4`;
            }
        }
        
        // Fallback to original behavior
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