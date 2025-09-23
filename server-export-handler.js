class ServerExportHandler {
    constructor() {
        this.isReady = true; // Server-side processing is always available
    }

    async exportStoryAsVideo(story, profilePicBlob, progressInfo = null) {
        try {
            console.log('Server export: Starting export for story:', story.filename);
            
            // Generate transparent overlay using client-side canvas (same as screenshot)
            console.log('Server export: Generating transparent overlay...');
            const overlayCanvas = await this.createTransparentOverlay(story, profilePicBlob, progressInfo);
            const overlayBlob = await this.canvasToBlob(overlayCanvas);
            
            // Prepare form data for server-side processing
            const formData = new FormData();
            formData.append('input_path', story.path);
            formData.append('overlay_png', overlayBlob, 'overlay.png');
            
            console.log('Server export: Sending request to server...');
            
            // Send request to server-side processing endpoint
            const response = await fetch('/api.php?action=process-video', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server processing failed: ${response.status} - ${errorText}`);
            }
            
            // Check if response is JSON (error) or binary (success)
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                throw new Error(`Server error: ${errorData.error}`);
            }
            
            // Return the video blob
            const videoBlob = await response.blob();
            console.log('Server export: Video processing completed, size:', videoBlob.size);
            
            return videoBlob;
            
        } catch (error) {
            console.error('Server export error:', error);
            throw error;
        }
    }
    
    getAvatarPathForUser(username) {
        // This would need to be implemented to find the avatar path for a user
        // For now, we'll construct it based on the standard naming pattern
        return `Avatars/${username}_avatar_20250812.jpg`;
    }
    
    formatFileName(originalFilename, displayDate = null) {
        // If display date is provided, use it instead of the filename date
        if (displayDate) {
            const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
            const parts = nameWithoutExt.split('_');
            
            if (parts.length >= 4 && parts[1] === 'story') {
                // Replace the date part with display date
                parts[2] = displayDate;
                return `${parts.join('_')}_exported.mp4`;
            }
        }
        
        // Fallback to original behavior
        const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
        return `${nameWithoutExt}_exported.mp4`;
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

    async createTransparentOverlay(story, profilePicBlob, progressInfo = null) {
        // Create transparent overlay using the exact screenshot logic but without media background
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size to match typical Instagram story dimensions
        canvas.width = 1080;
        canvas.height = 1920;

        // Keep background fully transparent - no background drawing at all
        // Just draw the UI overlay elements exactly like the screenshot

        // Use the exact overlay drawing logic from the screenshot implementation
        await this.drawOverlayForScreenshot(ctx, story, profilePicBlob, progressInfo);

        return canvas;
    }

    async drawOverlayForScreenshot(ctx, story, profilePicBlob, progressInfo = null) {
        const profileSize = 64;
        const profileX = 40;
        const profileY = 30;
        const username = story.username;

        // Draw Instagram-style progress bars at the top if progress info is provided
        if (progressInfo) {
            this.drawProgressBars(ctx, progressInfo);
        }

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

        // Draw username text with Instagram-like font - much smaller size  
        ctx.font = 'bold 24px "Proxima Nova", "Helvetica Neue", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'top'; // Changed from middle to top for alignment
        
        const textX = profileX + profileSize + 20;
        let currentY = profileY; // Align with top of avatar circle
        
        ctx.fillText(username, textX, currentY);

        // Handle reshare info for medicalmedium
        if (story.reshareInfo && username === 'medicalmedium') {
            // Load and draw reshare icon PNG (colored white)
            const iconSize = 18; // Smaller icon
            const iconX = textX;
            const iconY = currentY + 30; // Position below username
            
            try {
                // Load the reshare icon
                const reshareIcon = new Image();
                reshareIcon.src = '/reshareicon.png';
                
                await new Promise((resolve, reject) => {
                    reshareIcon.onload = () => resolve();
                    reshareIcon.onerror = () => {
                        console.warn('Failed to load reshare icon, using fallback');
                        resolve(); // Continue without icon
                    };
                });
                
                if (reshareIcon.complete && reshareIcon.naturalWidth > 0) {
                    // Create white version of the icon using color filters
                    ctx.save();
                    ctx.globalCompositeOperation = 'source-over';
                    
                    // Draw icon with white tint
                    ctx.filter = 'brightness(0) saturate(100%) invert(1)'; // Makes it white
                    ctx.drawImage(reshareIcon, iconX, iconY, iconSize, iconSize);
                    ctx.filter = 'none';
                    ctx.restore();
                }
            } catch (error) {
                console.warn('Error loading reshare icon:', error);
            }
            
            // Draw original username text - smaller size
            ctx.font = 'normal 20px "Proxima Nova", "Helvetica Neue", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.textBaseline = 'top';
            
            const reshareTextX = iconX + iconSize + 8; // Closer to icon
            const reshareTextY = iconY;
            
            ctx.fillText(`@${story.reshareInfo.originalUser}`, reshareTextX, reshareTextY);
        }
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    drawProgressBars(ctx, progressInfo) {
        // Instagram-style progress bars at the top of the video
        const { currentStory, totalStories, storyProgress } = progressInfo;
        
        const barHeight = 4;
        const barSpacing = 4;
        const topMargin = 20;
        const sideMargin = 20;
        const canvasWidth = ctx.canvas.width;
        
        // Calculate bar width based on available space
        const availableWidth = canvasWidth - (2 * sideMargin);
        const totalSpacing = (totalStories - 1) * barSpacing;
        const barWidth = (availableWidth - totalSpacing) / totalStories;
        
        ctx.save();
        
        for (let i = 0; i < totalStories; i++) {
            const x = sideMargin + (i * (barWidth + barSpacing));
            const y = topMargin;
            
            // Draw background bar (dark gray)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw progress bar
            if (i < currentStory) {
                // Completed stories - full white bar
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(x, y, barWidth, barHeight);
            } else if (i === currentStory) {
                // Current story - partial progress
                const progressWidth = barWidth * storyProgress;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(x, y, progressWidth, barHeight);
            }
            // Future stories remain as background only
        }
        
        ctx.restore();
    }

    canvasToBlob(canvas) {
        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), 'image/png');
        });
    }

    async concatenateVideos(videoBlobs, outputFilename) {
        try {
            console.log(`Server concatenation: Processing ${videoBlobs.length} video segments`);
            
            // If only one video, return it directly
            if (videoBlobs.length === 1) {
                return videoBlobs[0];
            }
            
            // Create FormData to send all video blobs to server
            const formData = new FormData();
            
            // Add each video blob with an indexed name
            for (let i = 0; i < videoBlobs.length; i++) {
                formData.append(`video_${i}`, videoBlobs[i], `segment_${i}.mp4`);
            }
            
            // Add the count and output filename
            formData.append('video_count', videoBlobs.length.toString());
            formData.append('output_filename', outputFilename);
            
            console.log('Server concatenation: Sending request to server...');
            
            // Send request to server-side concatenation endpoint
            const response = await fetch('/api.php?action=concatenate-videos', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server concatenation failed: ${response.status} - ${errorText}`);
            }
            
            // Check if response is JSON (error) or binary (success)
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                throw new Error(`Server concatenation error: ${errorData.error}`);
            }
            
            // Return the concatenated video blob
            const concatenatedBlob = await response.blob();
            console.log('Server concatenation: Completed, size:', concatenatedBlob.size);
            
            return concatenatedBlob;
            
        } catch (error) {
            console.error('Server concatenation error:', error);
            throw error;
        }
    }

    async exportVisualExperienceOptimized(stories, outputFilename) {
        try {
            console.log(`Server VE export: Processing ${stories.length} stories with proper overlays`);
            
            // Create FormData for sending story data with overlays
            const formData = new FormData();
            
            // Process each story and generate overlay PNGs
            const storySegments = [];
            for (let i = 0; i < stories.length; i++) {
                const story = stories[i];
                
                // Get profile picture blob if available
                let profilePicBlob = null;
                const profilePicUrl = this.getProfilePicture(story.username);
                if (profilePicUrl) {
                    try {
                        const response = await fetch(profilePicUrl);
                        profilePicBlob = await response.blob();
                    } catch (error) {
                        console.warn('Could not fetch profile picture for VE export:', error);
                    }
                }
                
                // Create progress information for this story
                const progressInfo = {
                    currentStory: i,
                    totalStories: stories.length,
                    storyProgress: 1.0 // Full progress for this segment
                };
                
                // Generate overlay with progress bars and user info
                const overlayCanvas = await this.createTransparentOverlay(story, profilePicBlob, progressInfo);
                const overlayBlob = await this.canvasToBlob(overlayCanvas);
                
                // Add story data and overlay to form
                storySegments.push({
                    path: story.path,
                    username: story.username,
                    type: story.type,
                    overlayIndex: i
                });
                
                // Add overlay PNG with indexed name
                formData.append(`overlay_${i}`, overlayBlob, `overlay_${i}.png`);
            }
            
            // Add story segments data and metadata
            formData.append('story_segments', JSON.stringify(storySegments));
            formData.append('output_filename', outputFilename);
            
            console.log('Server VE export: Sending stories with overlays to server...');
            
            // Send request to enhanced server-side Visual Experience endpoint
            const response = await fetch('/api.php?action=export-visual-experience-with-overlays', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server VE export failed: ${response.status} - ${errorText}`);
            }
            
            // Check if response is JSON (error) or binary (success)
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                throw new Error(`Server VE export error: ${errorData.error}`);
            }
            
            // Return the final concatenated video blob
            const finalBlob = await response.blob();
            console.log('Server VE export: Completed, size:', finalBlob.size);
            
            return finalBlob;
            
        } catch (error) {
            console.error('Server VE export error:', error);
            throw error;
        }
    }

    getProfilePicture(username) {
        // Try to match app.js getProfilePicture logic
        // Use multiple common date patterns since we don't have access to the full avatar map
        const commonDates = ['20250813', '20250812', '20250811'];
        
        // Since we can't test file existence server-side, return the most likely path
        // The actual file existence will be tested when the image loads
        return `/api.php?action=get-file&path=Avatars/${username}_avatar_20250812.jpg`;
    }
}

// Make it available globally
window.ServerExportHandler = ServerExportHandler;