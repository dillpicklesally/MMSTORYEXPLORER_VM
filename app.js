class StoryArchiveExplorer {
    constructor() {
        this.archives = new Map(); // Map of date -> stories
        this.currentStories = [];
        this.currentStoryIndex = 0;
        this.userStories = new Map(); // Map of username -> stories
        this.groupedStories = [];
        this.currentGroupIndex = 0;
        this.profilePictures = new Map(); // Map of username -> profile picture URL
        this.avatarFiles = new Map(); // Map of filename -> file object
        this.profileSnapshots = new Map(); // Map of username -> profile snapshots
        this.resharedUsersStories = new Map(); // Map of date -> reshared users' stories
        this.exportHandler = null; // Will be initialized based on availability
        
        this.initializeEventListeners();
        this.initializeUpdateStatus();
    }
    
    initializeEventListeners() {
        // Auto-load button
        const autoLoadBtn = document.getElementById('auto-load-btn');
        autoLoadBtn.addEventListener('click', () => {
            this.tryAutoLoad();
        });
        
        // File input
        const folderInput = document.getElementById('folder-input');
        const folderLabel = document.querySelector('.file-input-label');
        
        // Show NFS loading when label is clicked
        folderLabel.addEventListener('click', () => {
            this.showNFSLoading();
        });
        
        folderInput.addEventListener('change', (e) => {
            // Only process if files were actually selected
            if (e.target.files.length > 0) {
                this.handleFolderSelection(e);
            }
        });
        
        // View toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleView(e));
        });

        // Sort buttons
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleSort(e));
        });
        
        // Back button
        document.querySelector('.back-btn').addEventListener('click', () => this.showDatesView());
        
        // Modal controls
        document.querySelector('.close-btn').addEventListener('click', () => this.closeModal());
        document.querySelector('.nav-btn.prev').addEventListener('click', () => this.previousMedia());
        document.querySelector('.nav-btn.next').addEventListener('click', () => this.nextMedia());
        
        // Export button - toggle dropdown
        document.querySelector('.export-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExportDropdown();
        });
        
        // Export dropdown options
        document.querySelectorAll('.export-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const exportType = option.dataset.exportType;
                this.handleExportOption(exportType);
            });
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            this.closeExportDropdown();
        });
        
        // Close modal on background click
        document.getElementById('story-modal').addEventListener('click', (e) => {
            if (e.target.id === 'story-modal') {
                this.closeModal();
            }
        });
        
        // About modal controls
        document.getElementById('about-btn').addEventListener('click', () => {
            this.showAboutModal();
        });
        
        document.querySelector('.about-close-btn').addEventListener('click', () => {
            this.closeAboutModal();
        });
        
        // Close about modal on background click
        document.getElementById('about-modal').addEventListener('click', (e) => {
            if (e.target.id === 'about-modal') {
                this.closeAboutModal();
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('story-modal').classList.contains('active')) {
                if (e.key === 'ArrowLeft') this.previousMedia();
                if (e.key === 'ArrowRight') this.nextMedia();
                if (e.key === 'Escape') this.closeModal();
            } else if (document.getElementById('about-modal').classList.contains('active')) {
                if (e.key === 'Escape') this.closeAboutModal();
            }
        });
    }
    
    
    showLoading(text = 'Processing files...') {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = document.querySelector('.loading-text');
        loadingText.textContent = text;
        overlay.classList.add('active');
    }
    
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.remove('active');
    }
    
    updateProgress(percentage, text = '') {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = text || `${Math.round(percentage)}%`;
    }
    
    showNFSLoading() {
        const overlay = document.getElementById('nfs-loading-overlay');
        overlay.classList.add('active');
    }
    
    hideNFSLoading() {
        const overlay = document.getElementById('nfs-loading-overlay');
        overlay.classList.remove('active');
    }
    
    isNFSLoadingVisible() {
        const overlay = document.getElementById('nfs-loading-overlay');
        return overlay.classList.contains('active');
    }
    
    async tryAutoLoad() {
        // Show home view immediately
        this.showHomeView();
        
        // Start loading timer
        const loadingStartTime = Date.now();
        this.startLoadingTimer();
        
        try {
            // Check if server mode is enabled
            if (!window.SERVER_CONFIG || !window.SERVER_CONFIG.SERVER_MODE) {
                alert('Server mode is not enabled. Please use "Choose Different Folder" to browse your files.');
                return;
            }
            
            // Clear existing data
            this.archives.clear();
            this.userStories.clear();
            this.profileSnapshots.clear();
            
            // Load data in background
            await this.loadAvatarsFromServer();
            await this.loadProfileSnapshotsFromServer();
            await this.loadResharedUsersStoriesFromServer();
            
            // Load dates from server
            const dates = await this.loadDatesFromServer();
            if (!dates || dates.length === 0) {
                throw new Error('No archive dates found on server');
            }
            
            // Load all stories from all dates
            for (let i = 0; i < dates.length; i++) {
                const date = dates[i];
                const stories = await this.loadStoriesFromServer(date);
                
                if (stories && stories.length > 0) {
                    // Process stories for this date
                    this.processServerStories(date, stories);
                }
            }
            
            if (this.archives.size === 0) {
                alert('No story archives found in the server directory. Please check your archive path.');
                return;
            }
            
            // Stop loading timer and re-render views with loaded data
            this.stopLoadingTimer();
            this.renderDatesList();
            this.renderUsersList();
            this.renderProfilesList();
            this.renderReshareAnalytics();
            this.renderResharesByUser();
            this.renderResharedUsersStories();
            
        } catch (error) {
            console.error('Auto-load failed:', error);
            this.stopLoadingTimer();
            alert(`Could not load archive from server: ${error.message}\n\nPlease use "Choose Different Folder" to browse your files.`);
        }
    }
    
    startLoadingTimer() {
        this.loadingStartTime = Date.now();
        this.loadingTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.loadingStartTime) / 1000);
            const loadingText = document.querySelector('.content-loading-text');
            if (loadingText) {
                loadingText.textContent = `Loading from server...(${elapsed}s)`;
            }
        }, 1000);
    }
    
    stopLoadingTimer() {
        if (this.loadingTimerInterval) {
            clearInterval(this.loadingTimerInterval);
            this.loadingTimerInterval = null;
        }
    }
    
    async loadDatesFromServer() {
        const response = await fetch('/api.php?action=list-dates');
        if (!response.ok) {
            throw new Error(`Failed to load dates: ${response.statusText}`);
        }
        return await response.json();
    }
    
    async loadStoriesFromServer(date) {
        const response = await fetch(`/api.php?action=list-stories&date=${encodeURIComponent(date)}`);
        if (!response.ok) {
            throw new Error(`Failed to load stories for ${date}: ${response.statusText}`);
        }
        return await response.json();
    }
    
    async loadAvatarsFromServer() {
        try {
            const response = await fetch('/api.php?action=list-avatars');
            if (!response.ok) {
                console.warn('Failed to load avatars from server:', response.statusText);
                return;
            }
            const avatars = await response.json();
            
            // Clear existing profile pictures
            this.profilePictures.clear();
            
            // Process avatars
            for (const avatar of avatars) {
                const avatarUrl = `/api.php?action=get-file&path=${encodeURIComponent(avatar.path)}`;
                this.profilePictures.set(avatar.username, avatarUrl);
            }
            
            console.log(`Successfully loaded ${avatars.length} avatars from server`);
        } catch (error) {
            console.warn('Error loading avatars from server:', error);
        }
    }
    
    processServerStories(date, stories) {
        if (!this.archives.has(date)) {
            this.archives.set(date, []);
        }
        
        const dateStories = this.archives.get(date);
        
        for (const story of stories) {
            // Convert server story format to match file-based format
            const processedStory = {
                username: story.username,
                fileName: story.filename,
                filename: story.filename, // Add lowercase version for export compatibility
                url: `/api.php?action=get-file&path=${encodeURIComponent(story.path)}`,
                type: story.type,
                date: story.date,
                path: story.path,
                fileSize: 0, // Not available from server API
                isVideo: story.type === 'video',
                reshareInfo: this.extractReshareInfo(story.username, story.filename)
            };
            
            dateStories.push(processedStory);
            
            // Group by user
            if (story.username) {
                if (!this.userStories.has(story.username)) {
                    this.userStories.set(story.username, []);
                }
                this.userStories.get(story.username).push(processedStory);
            }
        }
    }

    loadAvatarFiles(files) {
        // Clear existing profile pictures
        this.profilePictures.clear();
        this.avatarFiles.clear();
        
        const avatarFiles = files.filter(file => {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            return parts.length >= 3 && parts[1] === 'Avatars';
        });
        
        let loadedCount = 0;
        avatarFiles.forEach((file, index) => {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            const filename = parts[2];
            
            // Match pattern: username_avatar_YYYYMMDD.jpg/jpeg
            const match = filename.match(/^(.+)_avatar_\d{8}\.(jpg|jpeg)$/i);
            
            if (match) {
                const username = match[1];
                const fileUrl = URL.createObjectURL(file);
                
                // Store with exact username match
                this.profilePictures.set(username, fileUrl);
                this.avatarFiles.set(filename, file);
                loadedCount++;
            }
        });
        
        console.log(`Successfully loaded ${loadedCount} avatars`);
    }
    
    loadProfileSnapshots(files) {
        // Clear existing profile snapshots
        this.profileSnapshots.clear();
        
        const snapshotFiles = files.filter(file => {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            // Look for files in AccountCaptures folders: /AutoExport/YYYYMMDD/AccountCaptures/
            return parts.length >= 4 && 
                   /^\d{8}$/.test(parts[1]) && // Date folder
                   parts[2] === 'AccountCaptures' &&
                   this.isImageFile(parts[3]); // Only image files
        });
        
        let loadedCount = 0;
        snapshotFiles.forEach(file => {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            const dateFolder = parts[1];
            const filename = parts[3];
            
            // Extract username from filename - try different patterns
            let username = this.extractUsernameFromSnapshot(filename);
            
            // Skip medicalmedium and cymbiotika from profile snapshots
            if (username && 
                username !== 'medicalmedium' && 
                username !== 'cymbiotika (Co-Founder)' &&
                username.toLowerCase().indexOf('cymbiotika') === -1) {
                
                // Normalize username to handle variations like _healingbyjane_, _healingbyjane, healingbyjane
                const normalizedUsername = this.normalizeUsername(username);
                
                if (!this.profileSnapshots.has(normalizedUsername)) {
                    this.profileSnapshots.set(normalizedUsername, []);
                }
                
                this.profileSnapshots.get(normalizedUsername).push({
                    file: file,
                    filename: filename,
                    date: dateFolder,
                    path: path,
                    url: null // Will be created when needed
                });
                
                loadedCount++;
            }
        });
        
        console.log(`Successfully loaded ${loadedCount} profile snapshots for ${this.profileSnapshots.size} users`);
    }
    
    async loadProfileSnapshotsFromServer() {
        // Clear existing profile snapshots
        this.profileSnapshots.clear();
        
        try {
            console.log('Loading profile snapshots from server...');
            const response = await fetch('/api.php?action=list-profile-snapshots');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const snapshots = await response.json();
            console.log('Received profile snapshots:', snapshots.length);
            
            // Group snapshots by username
            let loadedCount = 0;
            snapshots.forEach(snapshot => {
                const username = snapshot.username;
                
                if (username && 
                    username !== 'medicalmedium' && 
                    username !== 'cymbiotika (Co-Founder)' &&
                    username.toLowerCase().indexOf('cymbiotika') === -1) {
                    if (!this.profileSnapshots.has(username)) {
                        this.profileSnapshots.set(username, []);
                    }
                    
                    // Create a snapshot object similar to file-based loading
                    const snapshotObj = {
                        filename: snapshot.filename,
                        path: snapshot.path,
                        date: snapshot.date,
                        url: null // Will be loaded on demand via serveFile
                    };
                    
                    this.profileSnapshots.get(username).push(snapshotObj);
                    loadedCount++;
                }
            });
            
            console.log(`Successfully loaded ${loadedCount} profile snapshots for ${this.profileSnapshots.size} users from server`);
        } catch (error) {
            console.error('Failed to load profile snapshots from server:', error);
        }
    }
    
    async loadResharedUsersStoriesFromServer() {
        // Clear existing reshared users' stories
        this.resharedUsersStories.clear();
        
        try {
            console.log('Loading reshared users stories from server...');
            const response = await fetch('/api.php?action=list-reshared-users-stories');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const stories = await response.json();
            console.log('Received reshared users stories:', stories.length);
            
            // Group stories by date
            let loadedCount = 0;
            stories.forEach(story => {
                const date = story.date;
                
                if (date && story.username && story.filename) {
                    if (!this.resharedUsersStories.has(date)) {
                        this.resharedUsersStories.set(date, []);
                    }
                    
                    const storyObj = {
                        username: story.username,
                        filename: story.filename,
                        path: story.path,
                        type: story.type || (this.isImageFile(story.filename) ? 'image' : 'video'),
                        date: date,
                        url: null // Will be loaded on demand via serveFile
                    };
                    
                    this.resharedUsersStories.get(date).push(storyObj);
                    loadedCount++;
                }
            });
            
            console.log(`Successfully loaded ${loadedCount} reshared users stories for ${this.resharedUsersStories.size} dates from server`);
        } catch (error) {
            console.error('Failed to load reshared users stories from server:', error);
        }
    }
    
    isImageFile(filename) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }
    
    normalizeUsername(username) {
        // Remove leading and trailing underscores and dots
        const normalized = username.replace(/^[._]+|[._]+$/g, '');
        
        // Convert to lowercase for case-insensitive matching
        return normalized.toLowerCase();
    }
    
    extractUsernameFromSnapshot(filename) {
        // Remove file extension
        const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
        
        console.log('Extracting username from:', filename, '-> nameWithoutExt:', nameWithoutExt);
        
        let extractedUsername = null;
        
        // Try different patterns that might be used for profile snapshots
        // Pattern 1: username_profile_YYYYMMDD_HHMMSS
        let match = nameWithoutExt.match(/^(.+)_profile_\d{8}_\d{6}$/);
        if (match) {
            extractedUsername = match[1];
            console.log('Pattern 1 matched:', extractedUsername);
        }
        
        // Pattern 2: username_YYYYMMDD_HHMMSS  
        if (!extractedUsername) {
            match = nameWithoutExt.match(/^(.+)_\d{8}_\d{6}$/);
            if (match) {
                extractedUsername = match[1];
                console.log('Pattern 2 matched:', extractedUsername);
            }
        }
        
        // Pattern 3: username_screenshot_YYYYMMDD
        if (!extractedUsername) {
            match = nameWithoutExt.match(/^(.+)_screenshot_\d{8}$/);
            if (match) {
                extractedUsername = match[1];
                console.log('Pattern 3 matched:', extractedUsername);
            }
        }
        
        // Pattern 4: username_YYYYMMDD
        if (!extractedUsername) {
            match = nameWithoutExt.match(/^(.+)_\d{8}$/);
            if (match) {
                extractedUsername = match[1];
                console.log('Pattern 4 matched:', extractedUsername);
            }
        }
        
        // Pattern 5: username_profile (without timestamp)
        if (!extractedUsername) {
            match = nameWithoutExt.match(/^(.+)_profile$/);
            if (match) {
                extractedUsername = match[1];
                console.log('Pattern 5 matched:', extractedUsername);
            }
        }
        
        // Pattern 6: Just username if it doesn't contain timestamp patterns
        if (!extractedUsername && !/\d{8}/.test(nameWithoutExt) && !/\d{6}/.test(nameWithoutExt)) {
            extractedUsername = nameWithoutExt;
            console.log('Pattern 6 matched:', extractedUsername);
        }
        
        // Fallback: try to extract everything before the last underscore and numbers
        if (!extractedUsername) {
            match = nameWithoutExt.match(/^(.+?)_[\d_]+$/);
            if (match) {
                extractedUsername = match[1];
                console.log('Fallback pattern matched:', extractedUsername);
            }
        }
        
        // Final fallback: use the full filename without extension
        if (!extractedUsername) {
            extractedUsername = nameWithoutExt;
            console.log('Using full filename:', extractedUsername);
        }
        
        // Normalize the username - clean up all variations
        let normalizedUsername = extractedUsername;
        
        // Remove common suffixes
        normalizedUsername = normalizedUsername.replace(/_profile$/, '').replace(/_screenshot$/, '');
        normalizedUsername = normalizedUsername.replace(/_profile_.*$/, '');
        
        // Clean up leading/trailing underscores and dots
        normalizedUsername = normalizedUsername.replace(/^[._]+|[._]+$/g, '');
        
        console.log('Normalized username:', normalizedUsername);
        return normalizedUsername;
    }
    
    getProfilePictureForSnapshot(username) {
        // Enhanced avatar matching specifically for profile snapshots
        // Try exact match first
        if (this.profilePictures.has(username)) {
            return this.profilePictures.get(username);
        }
        
        // Try with underscores replaced by dots
        const usernameWithDots = username.replace(/_/g, '.');
        if (this.profilePictures.has(usernameWithDots)) {
            return this.profilePictures.get(usernameWithDots);
        }
        
        // Try with dots replaced by underscores
        const usernameWithUnderscores = username.replace(/\./g, '_');
        if (this.profilePictures.has(usernameWithUnderscores)) {
            return this.profilePictures.get(usernameWithUnderscores);
        }
        
        // Try normalized matching (remove all special chars and lowercase)
        const normalizedUsername = username.replace(/[._-]/g, '').toLowerCase();
        for (const [key, value] of this.profilePictures.entries()) {
            const normalizedKey = key.replace(/[._-]/g, '').toLowerCase();
            if (normalizedKey === normalizedUsername) {
                return value;
            }
        }
        
        // Try partial matching - check if username is contained in any profile picture name
        for (const [key, value] of this.profilePictures.entries()) {
            if (key.toLowerCase().includes(username.toLowerCase()) || 
                username.toLowerCase().includes(key.toLowerCase())) {
                return value;
            }
        }
        
        console.log(`No avatar found for profile snapshot user: ${username}`);
        return null;
    }
    
    async handleFolderSelection(event) {
        const files = Array.from(event.target.files);
        
        if (files.length === 0) {
            alert('No files selected');
            return;
        }
        
        try {
            // Hide NFS loading and show main loading overlay
            this.hideNFSLoading();
            this.showLoading('Analyzing folder structure...');
            
            // Update progress
            this.updateProgress(10, 'Clearing existing data...');
            
            // Clear existing data
            this.archives.clear();
            this.userStories.clear();
            this.profileSnapshots.clear();
            
            // Update progress
            this.updateProgress(20, 'Loading avatars...');
            
            // Load avatar files
            this.loadAvatarFiles(files);
            
            // Update progress
            this.updateProgress(30, 'Loading profile snapshots...');
            
            // Load profile snapshots
            this.loadProfileSnapshots(files);
            
            // Update progress
            this.updateProgress(50, 'Building folder structure...');
            
            // Build folder structure from file paths
            const folderStructure = this.buildFolderStructure(files);
            
            // Update progress
            this.updateProgress(80, 'Processing stories...');
            
            // Process the folder structure
            this.processFolderStructure(folderStructure);
            
            // Update progress
            this.updateProgress(90, 'Finalizing...');
            
            if (this.archives.size === 0) {
                this.hideLoading();
                this.hideNFSLoading(); // Ensure NFS loading is also hidden
                alert('No valid story archives found. Please select the AutoExport folder.');
                return;
            }
            
            // Update progress
            this.updateProgress(100, 'Complete!');
            
            
            // Hide loading and switch to home view
            setTimeout(() => {
                this.hideLoading();
                this.hideNFSLoading(); // Ensure NFS loading is also hidden
                this.showHomeView();
            }, 500);
            
        } catch (error) {
            this.hideLoading();
            this.hideNFSLoading(); // Ensure NFS loading is also hidden on error
            alert(`Error processing files: ${error.message}`);
        }
    }
    
    buildFolderStructure(files) {
        const structure = {};
        let processedFiles = 0;
        let skippedFiles = 0;
        
        const mediaFiles = files.filter(file => {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            
            // Skip if not enough path depth (need at least folder/date/user/file)
            if (parts.length < 4) return false;
            
            const dateFolder = parts[1];
            const userFolder = parts[2];
            const filename = parts[parts.length - 1];
            
            // Skip if not a valid date folder (8 digits)
            if (!/^\d{8}$/.test(dateFolder)) return false;
            
            // Skip AccountCaptures folder
            if (userFolder === 'AccountCaptures') return false;
            
            // Skip non-media files
            if (!this.isMediaFile(filename)) return false;
            
            return true;
        });
        
        
        mediaFiles.forEach((file, index) => {
            const path = file.webkitRelativePath;
            const parts = path.split('/');
            const dateFolder = parts[1];
            const userFolder = parts[2];
            const filename = parts[parts.length - 1];
            
            // Initialize structure
            if (!structure[dateFolder]) {
                structure[dateFolder] = {};
            }
            if (!structure[dateFolder][userFolder]) {
                structure[dateFolder][userFolder] = [];
            }
            
            // Add file with metadata
            structure[dateFolder][userFolder].push({
                file: file,
                filename: filename,
                path: path
            });
            
            processedFiles++;
            
        });
        
        // Sort files within each user folder by filename (they're numbered)
        let totalUsers = 0;
        Object.entries(structure).forEach(([date, dateData]) => {
            const userCount = Object.keys(dateData).length;
            totalUsers += userCount;
            
            Object.entries(dateData).forEach(([user, userFiles]) => {
                userFiles.sort((a, b) => {
                    // Extract numbers from filenames for proper sorting
                    const numA = this.extractNumberFromFilename(a.filename);
                    const numB = this.extractNumberFromFilename(b.filename);
                    return numA - numB;
                });
            });
            
        });
        
        
        return structure;
    }
    
    extractNumberFromFilename(filename) {
        // Extract the story number from filenames like "username_story_20250808_01.jpg"
        const match = filename.match(/_(\d+)\.(jpg|jpeg|png|mp4)/i);
        return match ? parseInt(match[1]) : 0;
    }
    
    processFolderStructure(structure) {
        Object.entries(structure).forEach(([date, users]) => {
            const stories = [];
            
            Object.entries(users).forEach(([username, files]) => {
                files.forEach(fileData => {
                    const story = {
                        username: username,
                        file: fileData.file,
                        type: this.getMediaType(fileData.filename),
                        filename: fileData.filename,
                        date: date,
                        path: fileData.path,
                        reshareInfo: this.extractReshareInfo(username, fileData.filename)
                    };
                    
                    stories.push(story);
                    
                    // Add to user stories map
                    if (!this.userStories.has(username)) {
                        this.userStories.set(username, []);
                    }
                    this.userStories.get(username).push(story);
                });
            });
            
            if (stories.length > 0) {
                this.archives.set(date, stories);
            }
        });
        
        console.log(`Processed ${this.archives.size} dates with ${this.userStories.size} users`);
    }
    
    isMediaFile(filename) {
        const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.webm'];
        return mediaExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }
    
    getMediaType(filename) {
        const videoExtensions = ['.mp4', '.mov', '.webm'];
        return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext)) ? 'video' : 'image';
    }
    
    extractReshareInfo(username, filename) {
        // Only process reshares for medicalmedium
        if (username !== 'medicalmedium') {
            return null;
        }
        
        // Find the last occurrence of _reshare_ in the filename
        const reshareIndex = filename.lastIndexOf('_reshare_');
        if (reshareIndex === -1) {
            return null;
        }
        
        // Extract everything after _reshare_ until the file extension
        const afterReshare = filename.substring(reshareIndex + '_reshare_'.length);
        const dotIndex = afterReshare.lastIndexOf('.');
        
        if (dotIndex === -1) {
            return null;
        }
        
        const reshareUsername = afterReshare.substring(0, dotIndex);
        
        // Count total reshares in filename
        const reshareCount = (filename.match(/_reshare_/g) || []).length;
        
        return {
            originalUser: reshareUsername,
            reshareCount: reshareCount
        };
    }
    
    showHomeView() {
        console.log('Switching to home view...');
        console.log('Archives found:', this.archives.size);
        console.log('Users found:', this.userStories.size);
        
        const pickerView = document.getElementById('file-picker-view');
        const homeView = document.getElementById('home-view');
        
        // Hide file picker view
        if (pickerView) {
            pickerView.classList.remove('active');
        }
        
        // Show home view
        if (homeView) {
            homeView.classList.add('active');
        }
        
        // Auto-open bubble after view is visible
        setTimeout(() => {
            this.showUpdateBubble();
        }, 500);
    }
    
    renderDatesList(sortType = 'newest') {
        const datesList = document.getElementById('dates-list');
        datesList.innerHTML = '';
        datesList.className = 'dates-list'; // Change from grid to list
        
        // Sort dates based on sortType
        let sortedDates;
        if (sortType === 'oldest') {
            sortedDates = Array.from(this.archives.keys()).sort((a, b) => a.localeCompare(b));
        } else {
            // Default to newest first
            sortedDates = Array.from(this.archives.keys()).sort((a, b) => b.localeCompare(a));
        }
        
        // Get the most recent date (first in sorted array when sorted newest first)
        const mostRecentDate = sortedDates.length > 0 ? sortedDates[0] : null;
        
        sortedDates.forEach(date => {
            let stories = this.archives.get(date);
            
            // Check if this is the most recent date (represents "Today")
            const isToday = date === mostRecentDate;
            
            // If this is the "Today" folder, filter to only show stories from today (since midnight)
            if (isToday && this.isFromToday(date)) {
                stories = stories.filter(story => this.isStoryFromToday(story.filename));
            }
            
            // Skip if no stories remain after filtering
            if (stories.length === 0) {
                return;
            }
            
            // Format YYYYMMDD to readable date
            const year = date.substring(0, 4);
            const month = date.substring(4, 6);
            const day = date.substring(6, 8);
            const formattedDate = isToday ? 'Today' : new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
            
            // Group stories by user
            const userStoriesMap = new Map();
            stories.forEach(story => {
                if (!userStoriesMap.has(story.username)) {
                    userStoriesMap.set(story.username, []);
                }
                userStoriesMap.get(story.username).push(story);
            });
            
            // Sort users with medicalmedium first, then by story count
            const sortedUsers = Array.from(userStoriesMap.entries()).sort((a, b) => {
                // Always put medicalmedium first
                if (a[0] === 'medicalmedium') return -1;
                if (b[0] === 'medicalmedium') return 1;
                
                const countDiff = b[1].length - a[1].length;
                if (countDiff !== 0) return countDiff;
                return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
            });
            
            // Create expandable date item
            const dateItem = document.createElement('div');
            dateItem.className = isToday ? 'date-list-item last-24-hours' : 'date-list-item';
            
            const uniqueUsers = new Set(stories.map(s => s.username));
            
            dateItem.innerHTML = `
                <div class="date-list-header">
                    <div class="date-list-info">
                        <div class="date-list-title">${formattedDate}</div>
                        <div class="date-list-subtitle">${stories.length} stories from ${uniqueUsers.size} users</div>
                    </div>
                    <div class="date-expand-icon">▶</div>
                </div>
                <div class="date-users-container">
                    <div class="date-inline-users" id="users-${date}">
                        <!-- Users will be populated here -->
                    </div>
                </div>
            `;
            
            // Add expand/collapse functionality
            const header = dateItem.querySelector('.date-list-header');
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDateExpansion(dateItem, date, sortedUsers);
            });
            
            datesList.appendChild(dateItem);
        });
    }
    
    toggleDateExpansion(dateItem, date, sortedUsers) {
        const isExpanded = dateItem.classList.contains('expanded');
        
        if (isExpanded) {
            // Collapse
            dateItem.classList.remove('expanded');
        } else {
            // Expand and populate users if not already done
            dateItem.classList.add('expanded');
            
            const usersContainer = dateItem.querySelector(`#users-${date}`);
            if (usersContainer.children.length === 0) {
                this.populateInlineUsers(usersContainer, sortedUsers);
            }
        }
    }
    
    populateInlineUsers(container, sortedUsers) {
        sortedUsers.forEach(([username, userStories]) => {
            const userItem = document.createElement('div');
            userItem.className = 'date-inline-user';
            
            const profilePic = this.getProfilePicture(username);
            const imageCount = userStories.filter(s => s.type === 'image').length;
            const videoCount = userStories.filter(s => s.type === 'video').length;
            const avatarContent = this.generateAvatarContent(username, profilePic);
            
            // Build stats text
            const stats = [];
            if (imageCount > 0) stats.push(`${imageCount} photos`);
            if (videoCount > 0) stats.push(`${videoCount} videos`);
            const statsText = stats.join(' • ');
            
            const exportButtonHtml = '';

            userItem.innerHTML = `
                <div class="date-inline-user-content">
                    <div class="date-inline-avatar" style="${avatarContent.style}">${avatarContent.letter}</div>
                    <div class="date-inline-info">
                        <div class="date-inline-name">${username}</div>
                        <div class="date-inline-stats">${userStories.length} stories${statsText ? ' • ' + statsText : ''}</div>
                    </div>
                </div>
                ${exportButtonHtml}
            `;
            
            userItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openUserStoriesFromDate(username, userStories);
            });
            
            container.appendChild(userItem);
        });
    }
    
    renderUsersList(sortType = 'a-z') {
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';
        usersList.className = 'users-list'; // Change from grid to list
        
        // Sort users based on sortType
        let sortedUsers = Array.from(this.userStories.entries());
        
        if (sortType === 'z-a') {
            sortedUsers.sort((a, b) => {
                // Always put medicalmedium first regardless of sort
                if (a[0] === 'medicalmedium') return -1;
                if (b[0] === 'medicalmedium') return 1;
                
                // Sort Z-A for everyone else
                return b[0].toLowerCase().localeCompare(a[0].toLowerCase());
            });
        } else {
            // Default A-Z sorting
            sortedUsers.sort((a, b) => {
                // Always put medicalmedium first regardless of sort
                if (a[0] === 'medicalmedium') return -1;
                if (b[0] === 'medicalmedium') return 1;
                
                // Sort A-Z for everyone else
                return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
            });
        }
        
        sortedUsers.forEach(([username, stories]) => {
            // Group stories by date for this user
            const dateStoriesMap = new Map();
            stories.forEach(story => {
                if (!dateStoriesMap.has(story.date)) {
                    dateStoriesMap.set(story.date, []);
                }
                dateStoriesMap.get(story.date).push(story);
            });
            
            // Sort dates in descending order
            const sortedDates = Array.from(dateStoriesMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
            
            // Calculate statistics
            const stats = this.calculateUserStats(stories, sortedDates);
            
            // Create expandable user item
            const userItem = document.createElement('div');
            userItem.className = 'user-list-item';
            
            const profilePic = this.getProfilePicture(username);
            const avatarContent = this.generateAvatarContent(username, profilePic);
            
            userItem.innerHTML = `
                <div class="user-list-header">
                    <div class="user-list-avatar" style="${avatarContent.style}">${avatarContent.letter}</div>
                    <div class="user-list-details">
                        <div class="user-list-name">${username}</div>
                        <div class="user-list-stats">
                            Total Stories: ${stats.totalStories} • Avg/Day: ${stats.avgPerDay} • Avg/Week: ${stats.avgPerWeek} • ${sortedDates.length} dates
                        </div>
                    </div>
                    <div class="user-expand-icon">▶</div>
                </div>
                <div class="user-dates-container">
                    <div class="user-inline-dates">
                        <!-- Dates will be populated here -->
                    </div>
                </div>
            `;
            
            // Add expand/collapse functionality
            const header = userItem.querySelector('.user-list-header');
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleUserExpansion(userItem, username, sortedDates);
            });
            
            usersList.appendChild(userItem);
        });
    }
    
    calculateUserStats(stories, sortedDates) {
        const totalStories = stories.length;
        const totalDates = sortedDates.length;
        
        if (totalDates === 0) {
            return {
                totalStories,
                avgPerDay: '0.0',
                avgPerWeek: '0.0'
            };
        }
        
        // Calculate date range
        const dates = sortedDates.map(([date]) => date).sort();
        const firstDate = new Date(
            dates[0].substring(0, 4),
            parseInt(dates[0].substring(4, 6)) - 1,
            dates[0].substring(6, 8)
        );
        const lastDate = new Date(
            dates[dates.length - 1].substring(0, 4),
            parseInt(dates[dates.length - 1].substring(4, 6)) - 1,
            dates[dates.length - 1].substring(6, 8)
        );
        
        // Calculate time span in days
        const timespanDays = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1);
        
        // Calculate averages
        const avgPerDay = (totalStories / timespanDays).toFixed(1);
        const avgPerWeek = (totalStories / (timespanDays / 7)).toFixed(1);
        
        return {
            totalStories,
            avgPerDay,
            avgPerWeek
        };
    }
    
    toggleUserExpansion(userItem, username, sortedDates) {
        const isExpanded = userItem.classList.contains('expanded');
        
        if (isExpanded) {
            // Collapse
            userItem.classList.remove('expanded');
        } else {
            // Expand and populate dates if not already done
            userItem.classList.add('expanded');
            
            // Use a more robust selector that doesn't rely on ID with special characters
            const datesContainer = userItem.querySelector('.user-inline-dates');
            if (datesContainer && datesContainer.children.length === 0) {
                this.populateInlineUserDates(datesContainer, username, sortedDates);
            } else if (!datesContainer) {
                console.error('Dates container not found for user:', username);
            }
        }
    }
    
    populateInlineUserDates(container, username, sortedDates) {
        sortedDates.forEach(([date, dateStories]) => {
            const dateItem = document.createElement('div');
            dateItem.className = 'user-inline-date';
            
            // Format YYYYMMDD to readable date
            const year = date.substring(0, 4);
            const month = date.substring(4, 6);
            const day = date.substring(6, 8);
            const formattedDate = new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            
            const imageCount = dateStories.filter(s => s.type === 'image').length;
            const videoCount = dateStories.filter(s => s.type === 'video').length;
            
            // Build stats text
            const stats = [];
            if (imageCount > 0) stats.push(`${imageCount} photos`);
            if (videoCount > 0) stats.push(`${videoCount} videos`);
            const statsText = stats.join(' • ');
            
            const exportButtonHtml = '';
            
            dateItem.innerHTML = `
                <div class="user-inline-date-info">
                    <div class="user-inline-date-name">${formattedDate}</div>
                    <div class="user-inline-date-stats">${dateStories.length} stories${statsText ? ' • ' + statsText : ''}</div>
                </div>
                ${exportButtonHtml}
                <div class="user-inline-date-arrow">→</div>
            `;
            
            dateItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openUserStoriesFromDate(username, dateStories);
            });
            
            container.appendChild(dateItem);
        });
    }
    
    getProfilePicture(username) {
        // Try exact match first (most common case)
        if (this.profilePictures.has(username)) {
            return this.profilePictures.get(username);
        }
        
        // Try with underscores replaced (for users like ava.lanelle vs ava_lanelle)
        const usernameWithUnderscores = username.replace(/\./g, '_');
        if (this.profilePictures.has(usernameWithUnderscores)) {
            return this.profilePictures.get(usernameWithUnderscores);
        }
        
        // Try with dots replaced (for users like rene_horbach vs rene.horbach)
        const usernameWithDots = username.replace(/_/g, '.');
        if (this.profilePictures.has(usernameWithDots)) {
            return this.profilePictures.get(usernameWithDots);
        }
        
        // Try partial matches for complex cases
        for (const [key, value] of this.profilePictures.entries()) {
            // Remove dots and underscores for fuzzy matching
            const normalizedKey = key.replace(/[._]/g, '').toLowerCase();
            const normalizedUsername = username.replace(/[._]/g, '').toLowerCase();
            
            if (normalizedKey === normalizedUsername) {
                return value;
            }
        }
        
        console.log(`No avatar found for: ${username}`);
        return null;
    }
    
    formatStoryDate(dateString, filename = null) {
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        const storyDate = new Date(`${year}-${month}-${day}`);
        
        const now = new Date();
        // Get today's date without time component
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const story = new Date(storyDate.getFullYear(), storyDate.getMonth(), storyDate.getDate());
        
        // Calculate difference in days
        const diffTime = today - story;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            // For "Today" stories, try to show relative time if filename is available
            if (filename && this.isFromToday(dateString)) {
                const storyTimestamp = this.extractTimestampFromFilename(filename);
                if (storyTimestamp) {
                    return this.formatRelativeTime(storyTimestamp);
                }
            }
            return 'today';
        } else if (diffDays === 1) {
            return 'yesterday';
        } else if (diffDays > 1 && diffDays <= 7) {
            return `${diffDays} days ago`;
        } else if (diffDays < 0 && diffDays >= -1) {
            return 'tomorrow'; // For stories in tomorrow's folder
        } else {
            const options = { month: 'short', day: 'numeric' };
            return storyDate.toLocaleDateString('en-US', options);
        }
    }
    
    extractTimestampFromFilename(filename) {
        // Look for pattern: YYYYMMDD_HHMMSS in filename
        const timestampMatch = filename.match(/(\d{8})_(\d{6})/);
        if (!timestampMatch) {
            return null;
        }
        
        const dateStr = timestampMatch[1]; // YYYYMMDD
        const timeStr = timestampMatch[2]; // HHMMSS
        
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(dateStr.substring(6, 8));
        const hour = parseInt(timeStr.substring(0, 2));
        const minute = parseInt(timeStr.substring(2, 4));
        const second = parseInt(timeStr.substring(4, 6));
        
        return new Date(year, month, day, hour, minute, second);
    }
    
    formatRelativeTime(storyTimestamp) {
        const now = new Date();
        const diffMs = now - storyTimestamp;
        
        // Convert to different time units
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMinutes < 1) {
            return 'just now';
        } else if (diffMinutes < 60) {
            return `${diffMinutes}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays === 1) {
            return '1d ago';
        } else {
            return `${diffDays}d ago`;
        }
    }
    
    isFromToday(dateString) {
        // Due to midnight download timing, "Today" stories are stored in tomorrow's date folder
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const tomorrowString = tomorrow.getFullYear() + 
                              String(tomorrow.getMonth() + 1).padStart(2, '0') + 
                              String(tomorrow.getDate()).padStart(2, '0');
        return dateString === tomorrowString;
    }
    
    isStoryFromToday(filename) {
        // Extract timestamp from filename and check if it's from today (since midnight)
        const storyTimestamp = this.extractTimestampFromFilename(filename);
        if (!storyTimestamp) {
            return false; // If no timestamp, exclude from "Today"
        }
        
        // Get today's midnight
        const today = new Date();
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        // Check if story timestamp is after today's midnight
        return storyTimestamp >= todayMidnight;
    }
    
    toggleView(event) {
        const viewType = event.target.dataset.view;
        
        // Update toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Update content views
        document.querySelectorAll('.content-view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewType}-view`).classList.add('active');
        
        // Refresh analytics data when switching to analytics tabs
        if (viewType === 'reshare-analytics') {
            this.renderReshareAnalytics();
        } else if (viewType === 'reshares-by-user') {
            this.renderResharesByUser();
        } else if (viewType === 'reshared-users-stories') {
            this.renderResharedUsersStories();
        }
    }

    handleSort(event) {
        const sortType = event.target.dataset.sort;
        const sortContainer = event.target.closest('.sort-buttons');
        
        // Update active state
        sortContainer.querySelectorAll('.sort-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        // Determine which view is active and apply sorting
        const activeView = document.querySelector('.toggle-btn.active').dataset.view;
        
        switch (activeView) {
            case 'dates':
                this.renderDatesList(sortType);
                break;
            case 'users':
                this.renderUsersList(sortType);
                break;
            case 'profiles':
                this.renderProfilesList(sortType);
                break;
            case 'reshares-by-user':
                this.renderResharesByUser(sortType);
                break;
            case 'reshared-users-stories':
                this.renderResharedUsersStories(sortType);
                break;
        }
    }
    
    showUsersForDate(date) {
        const stories = this.archives.get(date) || [];
        
        // Hide dates and users views
        document.getElementById('dates-view').classList.remove('active');
        document.getElementById('users-view').classList.remove('active');
        
        // Show date users view
        const dateUsersView = document.getElementById('date-users-view');
        dateUsersView.classList.add('active');
        
        // Update the date title
        const year = date.substring(0, 4);
        const month = date.substring(4, 6);
        const day = date.substring(6, 8);
        const formattedDate = new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        document.querySelector('.date-title').textContent = formattedDate;
        
        // Group stories by user
        const userStoriesMap = new Map();
        stories.forEach(story => {
            if (!userStoriesMap.has(story.username)) {
                userStoriesMap.set(story.username, []);
            }
            userStoriesMap.get(story.username).push(story);
        });
        
        // Render users list
        this.renderDateUsersList(date, userStoriesMap);
    }
    
    showDatesView() {
        // Hide date users view
        document.getElementById('date-users-view').classList.remove('active');
        
        // Show dates view (maintain current toggle state)
        const activeToggle = document.querySelector('.toggle-btn.active');
        const viewType = activeToggle?.dataset.view || 'dates';
        document.getElementById(`${viewType}-view`).classList.add('active');
    }
    
    renderDateUsersList(date, userStoriesMap) {
        const usersList = document.getElementById('date-users-list');
        usersList.innerHTML = '';
        
        // Sort users by story count (descending) then alphabetically
        const sortedUsers = Array.from(userStoriesMap.entries()).sort((a, b) => {
            const countDiff = b[1].length - a[1].length;
            if (countDiff !== 0) return countDiff;
            return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
        });
        
        sortedUsers.forEach(([username, userStories]) => {
            const userItem = document.createElement('div');
            userItem.className = 'user-list-item';
            
            const profilePic = this.getProfilePicture(username);
            const imageCount = userStories.filter(s => s.type === 'image').length;
            const videoCount = userStories.filter(s => s.type === 'video').length;
            const avatarContent = this.generateAvatarContent(username, profilePic);
            
            // Build stats text
            const stats = [];
            if (imageCount > 0) stats.push(`${imageCount} photos`);
            if (videoCount > 0) stats.push(`${videoCount} videos`);
            const statsText = stats.join(' • ');
            
            userItem.innerHTML = `
                <div class="user-list-avatar" style="${avatarContent.style}">${avatarContent.letter}</div>
                <div class="user-list-info">
                    <div class="user-list-name">@${username}</div>
                    <div class="user-list-stats">${userStories.length} stories${statsText ? ' • ' + statsText : ''}</div>
                </div>
                <div class="user-list-arrow">→</div>
            `;
            
            userItem.addEventListener('click', () => this.openUserStoriesFromDate(username, userStories));
            usersList.appendChild(userItem);
        });
    }
    
    openUserStoriesFromDate(username, userStories) {
        // Single group for user view from specific date
        this.groupedStories = [{
            username,
            stories: userStories
        }];
        this.currentGroupIndex = 0;
        this.currentStories = userStories;
        this.currentStoryIndex = 0;
        this.showStoryModal();
    }
    
    openDateStories(date) {
        const allStories = this.archives.get(date) || [];
        // Group stories by user for date view
        this.groupedStories = this.groupStoriesByUser(allStories);
        this.currentGroupIndex = 0;
        this.currentStories = this.groupedStories[0]?.stories || [];
        this.currentStoryIndex = 0;
        this.showStoryModal();
    }
    
    openUserStories(username) {
        const userStories = this.userStories.get(username) || [];
        // Single group for user view
        this.groupedStories = [{
            username,
            stories: userStories
        }];
        this.currentGroupIndex = 0;
        this.currentStories = userStories;
        this.currentStoryIndex = 0;
        this.showStoryModal();
    }
    
    groupStoriesByUser(stories) {
        const grouped = new Map();
        
        stories.forEach(story => {
            if (!grouped.has(story.username)) {
                grouped.set(story.username, []);
            }
            grouped.get(story.username).push(story);
        });
        
        // Convert to array format
        return Array.from(grouped.entries()).map(([username, userStories]) => ({
            username,
            stories: userStories
        }));
    }
    
    showStoryModal() {
        if (this.currentStories.length === 0) return;
        
        const modal = document.getElementById('story-modal');
        modal.classList.add('active');
        
        this.renderProgressBar();
        this.showCurrentStory();
    }
    
    renderProgressBar() {
        const progressContainer = document.querySelector('.progress-segments');
        progressContainer.innerHTML = '';
        
        // Only show progress for current user's stories
        const currentGroup = this.groupedStories[this.currentGroupIndex];
        if (!currentGroup) return;
        
        currentGroup.stories.forEach((_, index) => {
            const segment = document.createElement('div');
            segment.className = 'progress-segment';
            segment.innerHTML = '<div class="progress-fill"></div>';
            progressContainer.appendChild(segment);
        });
    }
    
    async showCurrentStory() {
        if (this.currentStoryIndex < 0 || this.currentStoryIndex >= this.currentStories.length) return;
        
        const story = this.currentStories[this.currentStoryIndex];
        const mediaContainer = document.querySelector('.story-media');
        const username = document.querySelector('.username');
        const storyDate = document.querySelector('.story-date');
        const avatarCircle = document.querySelector('.avatar-circle');
        
        // Update username
        username.textContent = story.username;
        
        // Handle reshare info for medicalmedium
        const reshareInfo = document.querySelector('.reshare-info');
        const reshareUsername = document.querySelector('.reshare-username');
        
        if (story.reshareInfo && story.username === 'medicalmedium') {
            reshareUsername.textContent = `@${story.reshareInfo.originalUser}`;
            reshareInfo.style.display = 'flex';
        } else {
            reshareInfo.style.display = 'none';
        }
        
        // Show date only when viewing by username (not by date)
        if (this.groupedStories.length === 1) {
            // Single user view - show the date
            storyDate.textContent = this.formatStoryDate(story.date, story.filename);
            storyDate.style.display = 'block';
        } else {
            // Multiple users by date - hide the date
            storyDate.style.display = 'none';
        }
        
        // Update avatar with profile picture if available
        const profilePic = this.getProfilePicture(story.username);
        if (profilePic) {
            avatarCircle.style.backgroundImage = `url('${profilePic}')`;
            avatarCircle.style.backgroundSize = 'cover';
            avatarCircle.style.backgroundPosition = 'center';
        } else {
            // Reset to gradient if no profile pic
            avatarCircle.style.backgroundImage = 'linear-gradient(135deg, #405de6, #833ab4, #c13584, #fd1d1d)';
        }
        
        // Clear previous media
        mediaContainer.innerHTML = '<div class="loading"></div>';
        
        try {
            // Create fresh object URL each time to avoid blob reference issues
            if (story.url && story.url.startsWith('blob:')) {
                URL.revokeObjectURL(story.url);
                story.url = null;
            }
            
            if (!story.url && story.file) {
                // Verify the file is still accessible
                if (story.file.size === undefined || story.file.size === 0) {
                    throw new Error('File is no longer accessible');
                }
                story.url = URL.createObjectURL(story.file);
            } else if (!story.url && story.path) {
                // Server-loaded story - construct API URL
                story.url = `/api.php?action=get-file&path=${encodeURIComponent(story.path)}`;
            }
            
            if (!story.url) {
                throw new Error('Unable to create file URL');
            }
            
            // Clear loading indicator
            mediaContainer.innerHTML = '';
            
            // Add new media with error handling
            if (story.type === 'image') {
                const img = document.createElement('img');
                img.onload = () => {
                    // Image loaded successfully
                    console.log(`Loaded image: ${story.filename}`);
                };
                img.onerror = (e) => {
                    console.error(`Failed to load image: ${story.filename}`, e);
                    mediaContainer.innerHTML = '<div class="error-message">Failed to load image</div>';
                };
                img.src = story.url;
                img.alt = story.filename;
                mediaContainer.appendChild(img);
            } else if (story.type === 'video') {
                const video = document.createElement('video');
                
                // Detect Safari
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                
                video.onloadeddata = () => {
                    console.log(`Loaded video: ${story.filename}`);
                };
                video.onerror = (e) => {
                    console.error(`Failed to load video: ${story.filename}`, e);
                    mediaContainer.innerHTML = '<div class="error-message">Failed to load video</div>';
                };
                
                // Safari-specific attributes MUST be set before src
                video.controls = true;
                video.muted = true;
                video.playsInline = true;
                video.preload = 'metadata';
                
                if (isSafari) {
                    // Safari requires specific handling
                    video.autoplay = false; // Safari often blocks autoplay
                    video.setAttribute('webkit-playsinline', 'true');
                    
                    // For Safari, we need to ensure the video element is in the DOM before setting src
                    mediaContainer.appendChild(video);
                    
                    // Add a small delay for Safari
                    setTimeout(() => {
                        video.src = story.url;
                        // Try to play after metadata loads
                        video.addEventListener('loadedmetadata', () => {
                            video.play().catch(err => {
                                console.log('Safari autoplay blocked:', err);
                            });
                        });
                    }, 100);
                } else {
                    // Chrome and other browsers
                    video.autoplay = true;
                    video.crossOrigin = 'anonymous';
                    video.src = story.url;
                    mediaContainer.appendChild(video);
                }
            }
        } catch (error) {
            console.error(`Error loading story ${story.filename}:`, error);
            mediaContainer.innerHTML = `<div class="error-message">Error loading ${story.filename}<br><small>${error.message}</small></div>`;
        }
        
        // Update progress
        this.updateProgress();
        
        // Update navigation buttons
        const isFirstStory = this.currentStoryIndex === 0 && this.currentGroupIndex === 0;
        const isLastStory = this.currentStoryIndex === this.currentStories.length - 1 && 
                           this.currentGroupIndex === this.groupedStories.length - 1;
        
        document.querySelector('.nav-btn.prev').disabled = isFirstStory;
        document.querySelector('.nav-btn.next').disabled = isLastStory;
    }
    
    updateProgress() {
        const segments = document.querySelectorAll('.progress-segment');
        console.log('Updating progress: segments found:', segments.length, 'current index:', this.currentStoryIndex);
        
        segments.forEach((segment, index) => {
            const fill = segment.querySelector('.progress-fill');
            if (fill) {
                if (index < this.currentStoryIndex) {
                    fill.style.setProperty('width', '100%', 'important');
                    console.log(`Segment ${index}: filled (past story)`, fill.style.width);
                } else if (index === this.currentStoryIndex) {
                    fill.style.setProperty('width', '100%', 'important');
                    console.log(`Segment ${index}: filled (current story)`, fill.style.width);
                } else {
                    fill.style.setProperty('width', '0%', 'important');
                    console.log(`Segment ${index}: empty (future story)`, fill.style.width);
                }
            } else {
                console.error(`No progress-fill found in segment ${index}`);
            }
        });
    }
    
    async previousStory() {
        if (this.currentStoryIndex > 0) {
            this.currentStoryIndex--;
            await this.showCurrentStory();
        } else if (this.currentGroupIndex > 0) {
            // Move to previous user's last story
            this.currentGroupIndex--;
            this.currentStories = this.groupedStories[this.currentGroupIndex].stories;
            this.currentStoryIndex = this.currentStories.length - 1;
            this.renderProgressBar();
            await this.showCurrentStory();
        }
    }
    
    async nextStory() {
        if (this.currentStoryIndex < this.currentStories.length - 1) {
            this.currentStoryIndex++;
            await this.showCurrentStory();
        } else if (this.currentGroupIndex < this.groupedStories.length - 1) {
            // Move to next user's first story
            this.currentGroupIndex++;
            this.currentStories = this.groupedStories[this.currentGroupIndex].stories;
            this.currentStoryIndex = 0;
            this.renderProgressBar();
            await this.showCurrentStory();
        }
    }
    
    closeModal() {
        const modal = document.getElementById('story-modal');
        modal.classList.remove('active', 'profile-snapshot-mode');
        
        // Clean up object URLs to free memory, but only for stories not currently in use
        this.currentStories.forEach(story => {
            if (story.url && story.url.startsWith('blob:')) {
                URL.revokeObjectURL(story.url);
                story.url = null;
            }
        });
        
        // Clean up profile snapshots URLs
        if (this.currentProfileSnapshots) {
            this.currentProfileSnapshots.forEach(snapshot => {
                if (snapshot.url && snapshot.url.startsWith('blob:')) {
                    URL.revokeObjectURL(snapshot.url);
                    snapshot.url = null;
                }
            });
            this.currentProfileSnapshots = [];
            this.currentSnapshotIndex = 0;
            this.currentProfileUsername = null;
        }
        
        this.currentStories = [];
        this.currentStoryIndex = 0;
    }
    
    showAboutModal() {
        const modal = document.getElementById('about-modal');
        modal.classList.add('active');
    }
    
    closeAboutModal() {
        const modal = document.getElementById('about-modal');
        modal.classList.remove('active');
    }
    
    async initializeExportHandler() {
        // Try Server-side export first (most reliable)
        if (window.ServerExportHandler) {
            this.exportHandler = new window.ServerExportHandler();
            console.log('Using Server-side export handler');
            return;
        }
        
        // Try FFmpeg if server-side not available
        if (window.ffmpegAvailable && window.ExportHandler) {
            try {
                this.exportHandler = new window.ExportHandler();
                // Test initialize to catch CORS/security errors
                await this.exportHandler.initialize();
                console.log('Using FFmpeg export handler');
                return;
            } catch (error) {
                console.warn('FFmpeg failed to initialize (likely CORS/security error), falling back to Canvas:', error);
                this.exportHandler = null;
                // Mark FFmpeg as unavailable for this session
                window.ffmpegAvailable = false;
            }
        }
        
        // Fallback to Canvas export
        if (window.CanvasExportHandler) {
            this.exportHandler = new window.CanvasExportHandler();
            console.log('Using Canvas export handler (fallback)');
        } else {
            console.error('No export handler available');
        }
    }

    showExportToast(title, message, progress = 0, state = 'progress') {
        const toast = document.getElementById('export-toast');
        const toastTitle = toast.querySelector('.toast-title');
        const toastMessage = toast.querySelector('.toast-message');
        const progressFill = toast.querySelector('.toast-progress-fill');
        const progressText = toast.querySelector('.toast-progress-text');
        
        // Update content
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
        
        // Update state classes
        toast.className = 'export-toast active';
        if (state !== 'progress') {
            toast.classList.add(state);
        }
        
        // Show toast
        toast.classList.add('active');
    }
    
    hideExportToast(delay = 3000) {
        const toast = document.getElementById('export-toast');
        setTimeout(() => {
            toast.classList.remove('active');
            // Reset state after animation completes
            setTimeout(() => {
                toast.className = 'export-toast';
            }, 400);
        }, delay);
    }
    
    updateExportProgress(progress, message) {
        const toast = document.getElementById('export-toast');
        const toastMessage = toast.querySelector('.toast-message');
        const progressFill = toast.querySelector('.toast-progress-fill');
        const progressText = toast.querySelector('.toast-progress-text');
        
        if (message) toastMessage.textContent = message;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
    }
    
    truncateFileName(fileName, maxLength) {
        if (fileName.length <= maxLength) {
            return fileName;
        }
        
        // Split filename and extension
        const lastDotIndex = fileName.lastIndexOf('.');
        const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
        const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
        
        // Calculate how much space we have for the name part
        const availableLength = maxLength - extension.length - 3; // 3 for "..."
        
        if (availableLength <= 0) {
            return '...' + extension;
        }
        
        // Calculate how to split the available space
        const startLength = Math.ceil(availableLength / 2);
        const endLength = Math.floor(availableLength / 2);
        
        const truncatedName = name.substring(0, startLength) + '...' + name.substring(name.length - endLength);
        return truncatedName + extension;
    }
    
    extractUsernameFromFilename(filename) {
        // Extract username from various filename patterns
        // Pattern: username_story_YYYYMMDD_##.ext
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
        const parts = nameWithoutExt.split('_');
        
        if (parts.length >= 4 && parts[1] === 'story') {
            return parts[0]; // Return username
        }
        
        // Fallback: try to extract username before first underscore
        return parts[0] || 'story';
    }
    
    extractStoryNumberFromFilename(filename) {
        // Extract story number from filename
        // Pattern: username_story_YYYYMMDD_##.ext
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
        const parts = nameWithoutExt.split('_');
        
        if (parts.length >= 4 && parts[1] === 'story') {
            return parts[3] || '01'; // Return story number or default to 01
        }
        
        // Fallback: try to find a number pattern
        const numberMatch = nameWithoutExt.match(/_([0-9]+)$/);
        return numberMatch ? numberMatch[1] : '01';
    }

    async exportCurrentStory() {
        const exportBtn = document.querySelector('.export-btn');
        
        try {
            // Initialize export handler if not already done
            if (!this.exportHandler) {
                await this.initializeExportHandler();
            }
            
            if (!this.exportHandler) {
                throw new Error('Export functionality not available');
            }
            
            // Show loading state on button
            exportBtn.classList.add('loading');
            
            // Show initial toast
            this.showExportToast('Exporting Story', 'Initializing export...', 0);
            
            // Get current story
            const story = this.currentStories[this.currentStoryIndex];
            if (!story) {
                throw new Error('No story selected');
            }
            
            console.log('Export: Story from currentStories:', story);
            console.log('Export: Story URL check:', story.url);
            
            // Fix URL for server-loaded stories if needed
            if (story.url && story.url.startsWith('/archive/') && !story.url.includes('/api.php')) {
                story.url = `/api.php?action=get-file&path=${encodeURIComponent(story.path)}`;
                console.log('Export: Updated story URL to:', story.url);
            }
            
            // Update progress - loading profile picture
            this.updateExportProgress(10, 'Loading profile picture...');
            
            // Get profile picture blob if available
            let profilePicBlob = null;
            const profilePicUrl = this.getProfilePicture(story.username);
            if (profilePicUrl) {
                try {
                    const response = await fetch(profilePicUrl);
                    profilePicBlob = await response.blob();
                } catch (error) {
                    console.warn('Could not fetch profile picture:', error);
                }
            }
            
            // Update progress - preparing
            this.updateExportProgress(25, 'Preparing media files...');
            
            // Start the actual export process
            this.updateExportProgress(30, 'Processing video export...');
            console.log('Starting video export for story:', story);
            console.log('Story URL:', story.url);
            console.log('Export handler type:', this.exportHandler.constructor.name);
            console.log('About to call exportStoryAsVideo...');
            
            const videoBlob = await this.exportHandler.exportStoryAsVideo(story, profilePicBlob);
            
            console.log('exportStoryAsVideo call completed');
            console.log('Video export completed, blob size:', videoBlob?.size);
            
            // Update progress - finalizing
            this.updateExportProgress(90, 'Finalizing export...');
            
            // Check if we're in profile snapshot mode
            const modal = document.getElementById('story-modal');
            const isProfileSnapshot = modal.classList.contains('profile-snapshot-mode');
            
            // Generate filename using display date instead of source filename date
            let fileName;
            if (isProfileSnapshot) {
                // For profile snapshots, preserve the original filename's date
                const nameWithoutExt = story.filename.replace(/\.[^/.]+$/, '');
                fileName = `${nameWithoutExt}_screencapture.mp4`;
            } else {
                // For regular stories, use the display date from explorer context
                const displayDate = story.date; // This is the explorer display date
                fileName = this.exportHandler.formatFileName(story.filename, displayDate);
            }
            
            // Update progress - downloading
            this.updateExportProgress(95, 'Starting download...');
            
            // Download the exported video
            await this.exportHandler.downloadBlob(videoBlob, fileName);
            
            // Show success state with truncated filename
            const truncatedFileName = this.truncateFileName(fileName, 40);
            this.updateExportProgress(100, `Successfully exported ${truncatedFileName}`);
            this.showExportToast('Export Complete!', `Downloaded ${truncatedFileName}`, 100, 'success');
            
            // Hide toast after delay
            this.hideExportToast(4000);
            
        } catch (error) {
            console.error('Export failed:', error);
            
            // Show error state
            this.showExportToast('Export Failed', error.message || 'An error occurred during export', 0, 'error');
            this.hideExportToast(5000);
        } finally {
            // Reset button state
            exportBtn.classList.remove('loading');
        }
    }
    
    toggleExportDropdown() {
        const dropdown = document.querySelector('.export-dropdown');
        const isVisible = dropdown.classList.contains('visible');
        
        if (isVisible) {
            this.closeExportDropdown();
        } else {
            // Check if we're in profile snapshot mode
            const modal = document.getElementById('story-modal');
            const isProfileSnapshot = modal.classList.contains('profile-snapshot-mode');
            
            if (isProfileSnapshot) {
                this.showProfileSnapshotExportOptions();
            } else {
                this.restoreOriginalExportOptions();
                dropdown.classList.add('visible');
            }
        }
    }
    
    closeExportDropdown() {
        const dropdown = document.querySelector('.export-dropdown');
        dropdown.classList.remove('visible');
    }
    
    restoreOriginalExportOptions() {
        const dropdown = document.querySelector('.export-dropdown');
        
        // Restore original export options for regular stories
        dropdown.innerHTML = `
            <div class="export-option" data-export-type="original">
                <div class="export-option-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </div>
                <div class="export-option-content">
                    <div class="export-option-title">Export Original File</div>
                    <div class="export-option-desc">Download the original file from archive</div>
                </div>
            </div>
            
            <div class="export-option" data-export-type="recording">
                <div class="export-option-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0 2 2v8a2 2 0 0 0 2 2z"></path>
                    </svg>
                </div>
                <div class="export-option-content">
                    <div class="export-option-title">Export Screen Recording</div>
                    <div class="export-option-desc">Video with overlay and username</div>
                </div>
            </div>
            
            <div class="export-option" data-export-type="screenshot">
                <div class="export-option-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                </div>
                <div class="export-option-content">
                    <div class="export-option-title">Take Screenshot</div>
                    <div class="export-option-desc">PNG screenshot of current view</div>
                </div>
            </div>
        `;
        
        // Re-add event listeners for original options
        dropdown.querySelectorAll('.export-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const exportType = e.currentTarget.dataset.exportType;
                this.handleExportOption(exportType);
            });
        });
    }
    
    showProfileSnapshotExportOptions() {
        const dropdown = document.querySelector('.export-dropdown');
        
        // Replace dropdown content with profile snapshot options
        dropdown.innerHTML = `
            <div class="export-option" data-export-type="profile-download">
                <div class="export-option-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </div>
                <div class="export-option-content">
                    <div class="export-option-title">Download Profile Snapshot</div>
                    <div class="export-option-desc">Download with original capture date</div>
                </div>
            </div>
        `;
        
        dropdown.classList.add('visible');
        
        // Add event listener for the new option
        const profileOption = dropdown.querySelector('[data-export-type="profile-download"]');
        profileOption.addEventListener('click', () => {
            this.downloadCurrentProfileSnapshot();
        });
    }
    
    async downloadCurrentProfileSnapshot() {
        try {
            this.closeExportDropdown();
            
            if (this.currentSnapshotIndex < 0 || this.currentSnapshotIndex >= this.currentProfileSnapshots.length) {
                console.error('No profile snapshot selected');
                return;
            }
            
            const snapshot = this.currentProfileSnapshots[this.currentSnapshotIndex];
            
            // Show toast notification
            this.showExportToast('Downloading Profile Snapshot', 'Starting download...', 0);
            
            // Download with original filename (preserves capture date)
            const response = await fetch(snapshot.url);
            const blob = await response.blob();
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = snapshot.filename; // Preserves original capture date
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Show success
            const truncatedFileName = this.truncateFileName(snapshot.filename, 40);
            this.showExportToast('Download Complete!', `Downloaded ${truncatedFileName}`, 100, 'success');
            this.hideExportToast(4000);
            
        } catch (error) {
            console.error('Failed to download profile snapshot:', error);
            this.showExportToast('Download Failed', error.message || 'Failed to download profile snapshot', 0, 'error');
            this.hideExportToast(5000);
        }
    }
    
    async handleExportOption(exportType) {
        this.closeExportDropdown();
        
        const story = this.currentStories[this.currentStoryIndex];
        if (!story) {
            console.error('No story selected');
            return;
        }
        
        switch (exportType) {
            case 'original':
                await this.exportOriginalFile(story);
                break;
            case 'recording':
                await this.exportCurrentStory();
                break;
            case 'screenshot':
                await this.exportScreenshot(story);
                break;
            default:
                console.error('Unknown export type:', exportType);
        }
    }
    
    async exportOriginalFile(story) {
        try {
            // Show toast notification
            this.showExportToast('Downloading Original File', 'Starting download...', 0);
            
            // Check if we're in profile snapshot mode
            const modal = document.getElementById('story-modal');
            const isProfileSnapshot = modal.classList.contains('profile-snapshot-mode');
            
            let downloadFileName;
            if (isProfileSnapshot) {
                // For profile snapshots, preserve the original filename
                downloadFileName = story.filename;
            } else {
                // For regular stories, rename to use display date instead of filename date
                const displayDate = story.date; // This is the explorer display date
                const nameWithoutExt = story.filename.replace(/\.[^/.]+$/, '');
                const extension = story.filename.match(/\.[^.]*$/)?.[0] || '';
                const parts = nameWithoutExt.split('_');
                
                if (parts.length >= 4 && parts[1] === 'story') {
                    // Replace the date part with display date: username_story_DISPLAYDATE_##.ext
                    parts[2] = displayDate;
                    downloadFileName = parts.join('_') + extension;
                } else {
                    // Fallback to original filename if pattern doesn't match
                    downloadFileName = story.filename;
                }
            }
            
            console.log('Downloading file with renamed filename:', downloadFileName);
            
            // Download original file
            const response = await fetch(story.url);
            const blob = await response.blob();
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Show success
            const truncatedFileName = this.truncateFileName(downloadFileName, 40);
            this.showExportToast('Download Complete!', `Downloaded ${truncatedFileName}`, 100, 'success');
            this.hideExportToast(4000);
            
        } catch (error) {
            console.error('Failed to download original file:', error);
            this.showExportToast('Download Failed', error.message || 'Failed to download original file', 0, 'error');
            this.hideExportToast(5000);
        }
    }
    
    async exportScreenshot(story) {
        try {
            // Initialize export handler if not already done
            if (!this.exportHandler) {
                await this.initializeExportHandler();
            }
            
            if (!this.exportHandler) {
                throw new Error('Export functionality not available');
            }
            
            // Show toast notification
            this.showExportToast('Creating Screenshot', 'Preparing image...', 0);
            
            // Get profile picture blob if available
            let profilePicBlob = null;
            const profilePicUrl = this.getProfilePicture(story.username);
            if (profilePicUrl) {
                try {
                    const response = await fetch(profilePicUrl);
                    profilePicBlob = await response.blob();
                } catch (error) {
                    console.warn('Could not fetch profile picture:', error);
                }
            }
            
            // Loading media
            this.updateExportProgress(25, 'Loading media...');
            
            // Create canvas for screenshot
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 1080;
            canvas.height = 1920;
            
            // Load the media (handle both images and videos)
            let mediaElement;
            let dimensions;
            
            if (story.type === 'video') {
                // For videos, create a video element and capture first frame
                const video = document.createElement('video');
                video.src = story.url;
                video.crossOrigin = 'anonymous';
                video.muted = true;
                // Safari compatibility for video loading
                video.preload = 'metadata';
                video.playsInline = true;
                
                await new Promise((resolve, reject) => {
                    video.onloadedmetadata = () => resolve();
                    video.onerror = (error) => {
                        console.error('Failed to load video for screenshot:', error);
                        reject(new Error('Failed to load video for screenshot'));
                    };
                });
                
                // Seek to first frame
                video.currentTime = 0;
                await new Promise((resolve) => {
                    video.onseeked = () => resolve();
                    video.currentTime = 0;
                });
                
                mediaElement = video;
                dimensions = this.getVideoDimensions(video, canvas.width, canvas.height);
            } else {
                // For images
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = story.url;
                await new Promise((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = (error) => {
                        console.error('Failed to load image for screenshot:', error);
                        reject(new Error('Failed to load image for screenshot'));
                    };
                });
                
                mediaElement = img;
                dimensions = this.getImageDimensions(img, canvas.width, canvas.height);
            }
            
            this.updateExportProgress(50, 'Composing image...');
            
            // Get dimensions and draw
            const { x, y, width, height } = dimensions;
            
            // Fill background with black
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw the main media
            ctx.drawImage(mediaElement, x, y, width, height);
            
            // Draw overlay (reuse logic from canvas export handler)
            await this.drawOverlayForScreenshot(ctx, story, profilePicBlob);
            
            this.updateExportProgress(75, 'Finalizing screenshot...');
            
            // Convert to blob and download
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create screenshot blob'));
                    }
                }, 'image/png');
            });
            
            // Check if we're in profile snapshot mode
            const modal = document.getElementById('story-modal');
            const isProfileSnapshot = modal.classList.contains('profile-snapshot-mode');
            
            // Generate filename with _screenshot suffix using display date
            let fileName;
            if (isProfileSnapshot) {
                // For profile snapshots, preserve original filename
                const nameWithoutExt = story.filename.replace(/\.[^/.]+$/, '');
                fileName = `${nameWithoutExt}_screenshot.png`;
            } else {
                // For regular stories, use the display date from explorer context
                const displayDate = story.date; // This is the explorer display date
                const baseFilename = this.extractUsernameFromFilename(story.filename);
                const storyNumber = this.extractStoryNumberFromFilename(story.filename);
                fileName = `${baseFilename}_story_${displayDate}_${storyNumber}_screenshot.png`;
            }
            
            // Download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Show success
            const truncatedFileName = this.truncateFileName(fileName, 40);
            this.updateExportProgress(100, `Successfully exported ${truncatedFileName}`);
            this.showExportToast('Screenshot Complete!', `Downloaded ${truncatedFileName}`, 100, 'success');
            this.hideExportToast(4000);
            
        } catch (error) {
            console.error('Screenshot export failed:', error);
            this.showExportToast('Screenshot Failed', error.message || 'Failed to create screenshot', 0, 'error');
            this.hideExportToast(5000);
        }
    }
    
    getImageDimensions(img, canvasWidth, canvasHeight) {
        const aspectRatio = img.width / img.height;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        let width, height, x, y;

        if (aspectRatio > canvasAspectRatio) {
            // Image is wider than canvas
            width = canvasWidth;
            height = canvasWidth / aspectRatio;
            x = 0;
            y = (canvasHeight - height) / 2;
        } else {
            // Image is taller than canvas
            width = canvasHeight * aspectRatio;
            height = canvasHeight;
            x = (canvasWidth - width) / 2;
            y = 0;
        }

        return { x, y, width, height };
    }
    
    getVideoDimensions(video, canvasWidth, canvasHeight) {
        const aspectRatio = video.videoWidth / video.videoHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        let width, height, x, y;

        if (aspectRatio > canvasAspectRatio) {
            // Video is wider than canvas
            width = canvasWidth;
            height = canvasWidth / aspectRatio;
            x = 0;
            y = (canvasHeight - height) / 2;
        } else {
            // Video is taller than canvas
            width = canvasHeight * aspectRatio;
            height = canvasHeight;
            x = (canvasWidth - width) / 2;
            y = 0;
        }

        return { x, y, width, height };
    }
    
    formatPostDateFromStory(story) {
        try {
            // Extract date from filename like "username_story_20250827_01.mp4"
            const match = story.filename.match(/_(\d{8})_/);
            if (!match) return null;
            
            const dateStr = match[1]; // YYYYMMDD
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
            const day = parseInt(dateStr.substring(6, 8));
            
            const date = new Date(year, month, day);
            
            // Format as "Sep 27, 2025"
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric', 
                year: 'numeric'
            });
        } catch (error) {
            console.warn('Failed to parse date from story filename:', story.filename, error);
            return null;
        }
    }
    
    async drawOverlayForScreenshot(ctx, story, profilePicBlob) {
        const profileSize = 83; // 72 * 1.15 ≈ 83
        const profileX = 49; // 43 * 1.15 ≈ 49
        const profileY = 68; // 59 * 1.15 ≈ 68
        const username = story.username;

        // Draw profile picture with circle mask
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

        // Set up very prominent drop shadow for video overlay
        ctx.shadowColor = 'rgba(0, 0, 0, 1.0)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;

        const textX = profileX + profileSize + 24; // 21 * 1.15 ≈ 24
        const lineHeight = 37; // 32 * 1.15 ≈ 37
        let currentY = profileY; // Align with top of avatar
        
        // 1. Draw username text first
        ctx.font = 'bold 39px "Proxima Nova", "Helvetica Neue", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'; // 34 * 1.15 ≈ 39
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'top';
        ctx.fillText(username, textX, currentY);
        
        currentY += lineHeight; // Move to next row
        
        // 2. Draw reshare info second (if exists)
        if (story.reshareInfo && username === 'medicalmedium') {
            // Draw reshare icon
            const iconSize = 23; // 20 * 1.15 = 23
            const iconX = textX;
            const iconY = currentY + 5; // Small offset to vertically center icon
            
            // Draw a simple reshare/repost icon (curved arrow)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2.5;
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
            ctx.font = 'normal 33px "Proxima Nova", "Helvetica Neue", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'; // 29 * 1.15 ≈ 33
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.textBaseline = 'top';
            
            const reshareTextX = iconX + iconSize + 9; // 8 * 1.15 ≈ 9
            ctx.fillText(`@${story.reshareInfo.originalUser}`, reshareTextX, currentY);
            
            currentY += lineHeight; // Move to next row
        }
        
        // 3. Draw post date third (last)
        const postDate = this.formatPostDateFromStory(story);
        if (postDate) {
            ctx.font = 'normal 29px "Proxima Nova", "Helvetica Neue", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'; // 25 * 1.15 ≈ 29
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.textBaseline = 'top';
            ctx.fillText(postDate, textX, currentY);
        }
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
    
    async exportVisualExperience(type, identifier, stories) {
        try {
            console.log('Starting visual experience export:', {type, identifier, storyCount: stories.length});
            
            // Initialize export handler if not already done
            if (!this.exportHandler) {
                await this.initializeExportHandler();
            }
            
            if (!this.exportHandler) {
                throw new Error('Export functionality not available');
            }
            
            // Sort stories chronologically
            const sortedStories = [...stories].sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
                return a.filename.localeCompare(b.filename);
            });
            
            const totalStories = sortedStories.length;
            
            // Generate filename based on type
            let exportFilename;
            if (type === 'user-date') {
                // identifier format: "username_YYYYMMDD"
                const [username, date] = identifier.split('_');
                exportFilename = `visual_experience_${username}_${date}_${totalStories}stories.mp4`;
            } else if (type === 'date') {
                const year = identifier.substring(0, 4);
                const month = identifier.substring(4, 6);
                const day = identifier.substring(6, 8);
                const formattedDate = `${year}${month}${day}`;
                exportFilename = `visual_experience_${formattedDate}_${totalStories}stories.mp4`;
            } else if (type === 'user') {
                exportFilename = `visual_experience_${identifier}_${totalStories}stories.mp4`;
            }
            
            // Show initial toast
            this.showExportToast('Exporting Visual Experience', `Processing ${totalStories} stories...`, 0);
            
            // Use optimized server-side approach if available
            if (this.exportHandler && typeof this.exportHandler.exportVisualExperienceOptimized === 'function') {
                console.log('Using optimized server-side Visual Experience export');
                
                this.updateExportProgress(10, 'Starting server-side processing...');
                const finalVideoBlob = await this.exportHandler.exportVisualExperienceOptimized(sortedStories, exportFilename);
                
                this.updateExportProgress(95, 'Starting download...');
                await this.exportHandler.downloadBlob(finalVideoBlob, exportFilename);
            } else {
                // Fallback to old client-side approach
                console.log('Using client-side Visual Experience export (fallback)');
                
                // Process each story and create video segments
                const videoSegments = [];
                
                for (let i = 0; i < sortedStories.length; i++) {
                    const story = sortedStories[i];
                    const progressPercent = Math.round((i / totalStories) * 90); // Reserve 10% for final assembly
                    
                    this.updateExportProgress(progressPercent, `Rendering story ${i + 1}/${totalStories}...`);
                    
                    try {
                        // Ensure story has a valid URL
                        if (!story.url && story.file) {
                            story.url = URL.createObjectURL(story.file);
                        }
                        
                        if (!story.url) {
                            console.warn(`Skipping story ${story.filename} - no valid URL`);
                            continue;
                        }
                        
                        // Get profile picture blob if available
                        let profilePicBlob = null;
                        const profilePicUrl = this.getProfilePicture(story.username);
                        if (profilePicUrl) {
                            try {
                                const response = await fetch(profilePicUrl);
                                profilePicBlob = await response.blob();
                            } catch (error) {
                                console.warn('Could not fetch profile picture:', error);
                            }
                        }
                        
                        // Create progress information for Instagram-style progress bars
                        const progressInfo = {
                            currentStory: i,
                            totalStories: totalStories,
                            storyProgress: 1.0 // Show full progress for this story segment
                        };
                        
                        // Create video segment for this story
                        let videoBlob;
                        if (story.type === 'image') {
                            // For images, create a 6-second video
                            videoBlob = await this.createImageVideoSegment(story, profilePicBlob, progressInfo);
                        } else {
                            // For videos, use the existing export system
                            if (!story.url && story.file) {
                                story.url = URL.createObjectURL(story.file);
                            }
                            videoBlob = await this.exportHandler.exportStoryAsVideo(story, profilePicBlob, progressInfo);
                        }
                        
                        videoSegments.push(videoBlob);
                    } catch (error) {
                        console.error(`Failed to process story ${i + 1}/${totalStories}:`, error);
                        // Continue processing other stories even if one fails
                    }
                }
                
                if (videoSegments.length === 0) {
                    throw new Error('No stories could be processed successfully');
                }
                
                // Combine all video segments
                this.updateExportProgress(90, 'Combining video segments...');
                const finalVideoBlob = await this.combineVideoSegments(videoSegments, exportFilename);
                
                // Download the final video
                this.updateExportProgress(95, 'Starting download...');
                await this.exportHandler.downloadBlob(finalVideoBlob, exportFilename);
            }
            
            // Show success
            const truncatedFileName = this.truncateFileName(exportFilename, 40);
            this.updateExportProgress(100, `Successfully exported ${truncatedFileName}`);
            this.showExportToast('Export Complete!', `Downloaded ${truncatedFileName}`, 100, 'success');
            this.hideExportToast(4000);
            
        } catch (error) {
            console.error('Visual experience export failed:', error);
            this.showExportToast('Export Failed', error.message || 'Failed to export visual experience', 0, 'error');
            this.hideExportToast(5000);
        }
    }
    
    async createImageVideoSegment(story, profilePicBlob, progressInfo = null) {
        try {
            // Ensure story has a valid URL
            if (!story.url && story.file) {
                story.url = URL.createObjectURL(story.file);
            }
            
            // Use Canvas export handler to create a 6-second video from image
            const canvasHandler = new CanvasExportHandler();
            return await canvasHandler.exportImageAsVideo(story, profilePicBlob, progressInfo);
        } catch (error) {
            console.error('Failed to create image video segment:', error);
            throw error;
        }
    }
    
    async combineVideoSegments(videoSegments, filename) {
        if (videoSegments.length === 1) {
            return videoSegments[0];
        }
        
        try {
            // Use FFmpeg for proper video concatenation if available
            if (this.exportHandler && typeof this.exportHandler.concatenateVideos === 'function') {
                console.log(`Concatenating ${videoSegments.length} video segments with FFmpeg`);
                return await this.exportHandler.concatenateVideos(videoSegments, filename);
            } else {
                // Fallback: return first segment
                console.warn(`FFmpeg not available. Exporting first of ${videoSegments.length} segments only.`);
                return videoSegments[0];
            }
        } catch (error) {
            console.error('Video concatenation failed, using first segment:', error);
            return videoSegments[0];
        }
    }
    
    renderProfilesList(sortType = 'a-z') {
        const profilesList = document.getElementById('profiles-list');
        if (!profilesList) return;
        
        profilesList.innerHTML = '';
        profilesList.className = 'profiles-list';
        
        if (this.profileSnapshots.size === 0) {
            profilesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📷</div>
                    <div class="empty-title">No Profile Snapshots Found</div>
                    <div class="empty-subtitle">Profile snapshots from AccountCaptures folders will appear here</div>
                </div>
            `;
            return;
        }
        
        // Sort users based on sortType
        const sortedUsers = Array.from(this.profileSnapshots.entries()).sort((a, b) => {
            const comparison = a[0].toLowerCase().localeCompare(b[0].toLowerCase());
            return sortType === 'z-a' ? -comparison : comparison;
        });
        
        sortedUsers.forEach(([rawUsername, snapshots]) => {
            // Additional cleanup: ensure no _profile suffix in display
            const username = rawUsername.replace(/_profile$/, '');
            const dateSnapshotsMap = new Map();
            snapshots.forEach(snapshot => {
                if (!dateSnapshotsMap.has(snapshot.date)) {
                    dateSnapshotsMap.set(snapshot.date, []);
                }
                dateSnapshotsMap.get(snapshot.date).push(snapshot);
            });
            
            const sortedDates = Array.from(dateSnapshotsMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
            const profilePic = this.getProfilePictureForSnapshot(username);
            const avatarContent = this.generateAvatarContent(username, profilePic);
            
            const userItem = document.createElement('div');
            userItem.className = 'profile-list-item';
            userItem.innerHTML = `
                <div class="profile-list-header">
                    <div class="profile-list-avatar" style="${avatarContent.style}">${avatarContent.letter}</div>
                    <div class="profile-list-details">
                        <div class="profile-list-name">${username}</div>
                        <div class="profile-list-stats">${snapshots.length} snapshots • ${sortedDates.length} dates</div>
                    </div>
                    <div class="profile-expand-icon">▶</div>
                </div>
                <div class="profile-dates-container">
                    <div class="profile-inline-dates"></div>
                </div>
            `;
            
            const header = userItem.querySelector('.profile-list-header');
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleProfileExpansion(userItem, rawUsername, sortedDates);
            });
            
            profilesList.appendChild(userItem);
        });
    }
    
    toggleProfileExpansion(userItem, username, sortedDates) {
        const isExpanded = userItem.classList.contains('expanded');
        if (isExpanded) {
            userItem.classList.remove('expanded');
        } else {
            userItem.classList.add('expanded');
            const datesContainer = userItem.querySelector('.profile-inline-dates');
            if (datesContainer && datesContainer.children.length === 0) {
                this.populateInlineProfileDates(datesContainer, username, sortedDates);
            }
        }
    }
    
    populateInlineProfileDates(container, username, sortedDates) {
        sortedDates.forEach(([date, dateSnapshots]) => {
            const dateItem = document.createElement('div');
            dateItem.className = 'profile-inline-date';
            
            const year = date.substring(0, 4);
            const month = date.substring(4, 6);
            const day = date.substring(6, 8);
            const formattedDate = new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            });
            
            dateItem.innerHTML = `
                <div class="profile-inline-date-info">
                    <div class="profile-inline-date-name">${formattedDate}</div>
                    <div class="profile-inline-date-stats">${dateSnapshots.length} snapshots</div>
                </div>
                <div class="profile-inline-date-arrow">→</div>
            `;
            
            dateItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openProfileSnapshotsForDate(username, date);
            });
            
            container.appendChild(dateItem);
        });
    }
    
    openProfileSnapshotsForDate(username, targetDate) {
        // Get all snapshots for this user
        console.log('Opening profile snapshots for user:', username, 'target date:', targetDate);
        console.log('Available users in profileSnapshots:', Array.from(this.profileSnapshots.keys()));
        const allUserSnapshots = this.profileSnapshots.get(username) || [];
        console.log('Found snapshots for user:', allUserSnapshots.length);
        
        // Sort all snapshots chronologically (by date, then by filename for order within date)
        const sortedSnapshots = [...allUserSnapshots].sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.filename.localeCompare(b.filename);
        });
        
        // Find the index of the first snapshot for the target date
        const startIndex = sortedSnapshots.findIndex(snapshot => snapshot.date === targetDate);
        
        // Open with all snapshots and set the correct starting index
        this.openProfileSnapshots(username, sortedSnapshots, startIndex >= 0 ? startIndex : 0);
    }
    
    openProfileSnapshots(username, snapshots, startIndex = 0) {
        this.currentProfileSnapshots = snapshots;
        this.currentSnapshotIndex = startIndex;
        this.currentProfileUsername = username; // Store the username for navigation
        this.showProfileSnapshotModal(username);
    }
    
    showProfileSnapshotModal(username) {
        if (this.currentProfileSnapshots.length === 0) return;
        const modal = document.getElementById('story-modal');
        modal.classList.add('active', 'profile-snapshot-mode');
        this.renderProfileProgressBar();
        this.showCurrentProfileSnapshot(username);
    }
    
    renderProfileProgressBar() {
        const progressContainer = document.querySelector('.progress-segments');
        progressContainer.innerHTML = '';
        this.currentProfileSnapshots.forEach(() => {
            const segment = document.createElement('div');
            segment.className = 'progress-segment';
            segment.innerHTML = '<div class="progress-fill"></div>';
            progressContainer.appendChild(segment);
        });
    }
    
    async showCurrentProfileSnapshot(username) {
        if (this.currentSnapshotIndex < 0 || this.currentSnapshotIndex >= this.currentProfileSnapshots.length) return;
        
        const snapshot = this.currentProfileSnapshots[this.currentSnapshotIndex];
        const mediaContainer = document.querySelector('.story-media');
        const usernameEl = document.querySelector('.username');
        const storyDate = document.querySelector('.story-date');
        const avatarCircle = document.querySelector('.avatar-circle');
        const reshareInfo = document.querySelector('.reshare-info');
        
        usernameEl.textContent = username + ' Profile';
        reshareInfo.style.display = 'none';
        storyDate.textContent = this.formatStoryDate(snapshot.date);
        storyDate.style.display = 'block';
        
        const profilePic = this.getProfilePictureForSnapshot(username);
        if (profilePic) {
            avatarCircle.style.backgroundImage = `url('${profilePic}')`;
            avatarCircle.style.backgroundSize = 'cover';
            avatarCircle.style.backgroundPosition = 'center';
        } else {
            avatarCircle.style.backgroundImage = 'linear-gradient(135deg, #405de6, #833ab4, #c13584, #fd1d1d)';
        }
        
        mediaContainer.innerHTML = '<div class="loading"></div>';
        
        try {
            // Handle loading from file object (local mode) vs server API
            if (!snapshot.url) {
                if (snapshot.file) {
                    // File object from local upload
                    snapshot.url = URL.createObjectURL(snapshot.file);
                } else if (snapshot.path) {
                    // Server-side path - construct API URL
                    snapshot.url = `/api.php?action=get-file&path=${encodeURIComponent(snapshot.path)}`;
                } else {
                    throw new Error('No file or path available for snapshot');
                }
            }
            
            mediaContainer.innerHTML = '';
            const img = document.createElement('img');
            img.onload = () => console.log(`Loaded profile snapshot: ${snapshot.filename}`);
            img.onerror = () => mediaContainer.innerHTML = '<div class="error-message">Failed to load profile snapshot</div>';
            img.src = snapshot.url;
            img.alt = snapshot.filename;
            mediaContainer.appendChild(img);
        } catch (error) {
            console.error(`Error loading profile snapshot ${snapshot.filename}:`, error);
            mediaContainer.innerHTML = `<div class="error-message">Error loading ${snapshot.filename}</div>`;
        }
        
        this.updateProfileProgress();
        
        const isFirstSnapshot = this.currentSnapshotIndex === 0;
        const isLastSnapshot = this.currentSnapshotIndex === this.currentProfileSnapshots.length - 1;
        
        const prevBtn = document.querySelector('.nav-btn.prev');
        const nextBtn = document.querySelector('.nav-btn.next');
        
        // Hide buttons completely instead of disabling them
        prevBtn.style.display = isFirstSnapshot ? 'none' : 'flex';
        nextBtn.style.display = isLastSnapshot ? 'none' : 'flex';
    }
    
    updateProfileProgress() {
        const segments = document.querySelectorAll('.progress-segment');
        segments.forEach((segment, index) => {
            const fill = segment.querySelector('.progress-fill');
            if (index < this.currentSnapshotIndex) {
                fill.style.width = '100%';
            } else if (index === this.currentSnapshotIndex) {
                fill.style.width = '100%';
            } else {
                fill.style.width = '0%';
            }
        });
    }
    
    // Navigation methods that work for both stories and profile snapshots
    async previousMedia() {
        const modal = document.getElementById('story-modal');
        if (modal.classList.contains('profile-snapshot-mode')) {
            await this.previousProfileSnapshot();
        } else {
            await this.previousStory();
        }
    }
    
    async nextMedia() {
        const modal = document.getElementById('story-modal');
        if (modal.classList.contains('profile-snapshot-mode')) {
            await this.nextProfileSnapshot();
        } else {
            await this.nextStory();
        }
    }
    
    async previousProfileSnapshot() {
        if (this.currentSnapshotIndex > 0) {
            this.currentSnapshotIndex--;
            await this.showCurrentProfileSnapshot(this.currentProfileUsername);
        }
    }
    
    async nextProfileSnapshot() {
        if (this.currentSnapshotIndex < this.currentProfileSnapshots.length - 1) {
            this.currentSnapshotIndex++;
            await this.showCurrentProfileSnapshot(this.currentProfileUsername);
        }
    }
    
    renderReshareAnalytics() {
        const analyticsView = document.getElementById('reshare-analytics-view');
        if (!analyticsView) return;

        // Get all medicalmedium stories with reshare info
        const medicalMediumStories = this.userStories.get('medicalmedium') || [];
        const reshareStories = medicalMediumStories.filter(story => story.reshareInfo);
        
        if (reshareStories.length === 0) {
            this.renderEmptyReshareAnalytics();
            return;
        }

        // Calculate frequency statistics
        const userFrequency = new Map();
        const userTimelineData = new Map();

        reshareStories.forEach(story => {
            const originalUser = story.reshareInfo.originalUser;
            
            // Count frequency
            userFrequency.set(originalUser, (userFrequency.get(originalUser) || 0) + 1);
            
            // Timeline data
            if (!userTimelineData.has(originalUser)) {
                userTimelineData.set(originalUser, new Map());
            }
            const userTimeline = userTimelineData.get(originalUser);
            userTimeline.set(story.date, (userTimeline.get(story.date) || 0) + 1);
        });

        // Update statistics
        this.updateReshareStats(reshareStories.length, userFrequency.size, userFrequency);

        // Render frequency chart
        this.renderFrequencyChart(userFrequency);

        // Render timeline chart
        this.renderTimelineChart(userTimelineData);
    }

    renderEmptyReshareAnalytics() {
        const frequencyChart = document.getElementById('frequency-chart');
        const timelineChart = document.getElementById('timeline-chart');
        
        frequencyChart.innerHTML = `
            <div class="empty-analytics">
                <div class="empty-analytics-icon">📊</div>
                <div class="empty-analytics-title">No Reshare Data</div>
                <div>No reshared stories found for @medicalmedium</div>
            </div>
        `;
        
        const canvas = timelineChart;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#a0a0a0';
        ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
    }

    updateReshareStats(totalReshares, uniqueUsers, userFrequency) {
        document.getElementById('total-reshares').textContent = totalReshares.toLocaleString();
        document.getElementById('unique-reshares').textContent = uniqueUsers;
        
        const avgPerUser = uniqueUsers > 0 ? (totalReshares / uniqueUsers).toFixed(1) : '0';
        document.getElementById('avg-reshares-per-user').textContent = avgPerUser;
    }

    renderFrequencyChart(userFrequency) {
        const frequencyChart = document.getElementById('frequency-chart');
        frequencyChart.innerHTML = '';

        // Sort users by frequency (descending)
        const sortedUsers = Array.from(userFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20); // Show top 20

        const maxCount = sortedUsers[0]?.[1] || 1;

        sortedUsers.forEach(([username, count], index) => {
            const profilePic = this.getProfilePicture(username);
            const percentage = (count / maxCount) * 100;
            const avatarContent = this.generateAvatarContent(username, profilePic);

            const item = document.createElement('div');
            item.className = 'frequency-item';
            item.innerHTML = `
                <div class="frequency-rank">${index === 0 ? '🏆 1' : index === 1 ? '🥈 2' : index === 2 ? '🥉 3' : index + 1}</div>
                <div class="frequency-avatar" style="${avatarContent.style}">${avatarContent.letter}</div>
                <div class="frequency-info">
                    <div class="frequency-username">${username}</div>
                    <div class="frequency-stats">${count} reshares</div>
                </div>
                <div class="frequency-bar-container">
                    <div class="frequency-bar" style="width: ${percentage}%"></div>
                </div>
                <div class="frequency-count">${count}</div>
            `;

            item.addEventListener('click', () => {
                this.showResharesBySpecificUser(username);
            });

            frequencyChart.appendChild(item);
        });
    }

    renderTimelineChart(userTimelineData) {
        const canvas = document.getElementById('timeline-chart');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = 400;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Get top 15 users by total reshares
        const userTotals = new Map();
        userTimelineData.forEach((timeline, username) => {
            const total = Array.from(timeline.values()).reduce((sum, count) => sum + count, 0);
            userTotals.set(username, total);
        });

        const top15Users = Array.from(userTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([username]) => username);

        if (top15Users.length === 0) {
            ctx.fillStyle = '#a0a0a0';
            ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No timeline data available', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Get all dates and sort them
        const allDates = new Set();
        userTimelineData.forEach(timeline => {
            timeline.forEach((count, date) => allDates.add(date));
        });
        const sortedDates = Array.from(allDates).sort();

        if (sortedDates.length === 0) return;

        // Chart dimensions - extra padding on right for legend
        const padding = 60;
        const legendWidth = 150;
        const chartWidth = canvas.width - 2 * padding - legendWidth;
        const chartHeight = canvas.height - 2 * padding;

        // Find max count for y-axis scaling
        let maxCount = 0;
        userTimelineData.forEach(timeline => {
            timeline.forEach(count => {
                maxCount = Math.max(maxCount, count);
            });
        });

        // Draw axes
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + chartHeight);
        ctx.lineTo(padding + chartWidth, padding + chartHeight);
        ctx.stroke();

        // Draw lines for each user
        const colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
            '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
            '#686de0', '#4834d4', '#00a085', '#fc5c65', '#26de81'
        ];

        // Store line data for hover interactions
        canvas.lineData = [];

        top15Users.forEach((username, userIndex) => {
            const timeline = userTimelineData.get(username);
            if (!timeline) return;

            const color = colors[userIndex % colors.length];
            const linePoints = [];
            
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();

            let firstPoint = true;
            sortedDates.forEach((date, dateIndex) => {
                const count = timeline.get(date) || 0;
                const x = padding + (dateIndex / (sortedDates.length - 1)) * chartWidth;
                const y = padding + chartHeight - (count / maxCount) * chartHeight;

                linePoints.push({ x, y, count });

                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }

                // Draw point
                ctx.fillRect(x - 2, y - 2, 4, 4);
            });

            ctx.stroke();

            // Store line data for hover
            canvas.lineData.push({
                username,
                color,
                userIndex,
                points: linePoints,
                timeline
            });

            // Draw legend item with better positioning
            const legendX = padding + chartWidth + 20;
            const legendY = padding + userIndex * 18;
            
            ctx.fillStyle = color;
            ctx.fillRect(legendX, legendY, 12, 12);
            ctx.fillStyle = '#808080';
            ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(username, legendX + 18, legendY + 9);
        });

        // Add mouse event listeners for hover effect
        this.addChartHoverEffects(canvas, top15Users, colors, userTimelineData, sortedDates, padding, chartWidth, chartHeight, maxCount);

        // Draw y-axis labels
        ctx.fillStyle = '#a0a0a0';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const value = (maxCount * i / 5).toFixed(0);
            const y = padding + chartHeight - (i / 5) * chartHeight;
            ctx.fillText(value, padding - 10, y + 4);
        }

        // Draw x-axis labels (simplified - show first, middle, last)
        ctx.textAlign = 'center';
        if (sortedDates.length >= 3) {
            [0, Math.floor(sortedDates.length / 2), sortedDates.length - 1].forEach(index => {
                const date = sortedDates[index];
                const x = padding + (index / (sortedDates.length - 1)) * chartWidth;
                const formattedDate = `${date.substring(4, 6)}/${date.substring(6, 8)}`;
                ctx.fillText(formattedDate, x, canvas.height - padding + 15);
            });
        }
    }

    renderResharesByUser(sortType = 'a-z') {
        const resharesList = document.getElementById('reshares-list');
        if (!resharesList) return;

        resharesList.innerHTML = '';
        resharesList.className = 'users-list'; // Use same layout as users list

        // Get all medicalmedium stories with reshare info
        const medicalMediumStories = this.userStories.get('medicalmedium') || [];
        const reshareStories = medicalMediumStories.filter(story => story.reshareInfo);

        if (reshareStories.length === 0) {
            resharesList.innerHTML = `
                <div class="empty-analytics">
                    <div class="empty-analytics-icon">🔄</div>
                    <div class="empty-analytics-title">No Reshared Stories</div>
                    <div>No reshared stories found for @medicalmedium</div>
                </div>
            `;
            return;
        }

        // Group reshare stories by original user
        const userReshares = new Map();
        reshareStories.forEach(story => {
            const originalUser = story.reshareInfo.originalUser;
            if (!userReshares.has(originalUser)) {
                userReshares.set(originalUser, []);
            }
            userReshares.get(originalUser).push(story);
        });

        // Sort users alphabetically
        let sortedUsers = Array.from(userReshares.entries());
        if (sortType === 'z-a') {
            sortedUsers.sort((a, b) => b[0].toLowerCase().localeCompare(a[0].toLowerCase()));
        } else {
            // Default to A-Z sorting
            sortedUsers.sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()));
        }

        sortedUsers.forEach(([username, userStories]) => {
            // Group stories by date
            const dateStoriesMap = new Map();
            userStories.forEach(story => {
                if (!dateStoriesMap.has(story.date)) {
                    dateStoriesMap.set(story.date, []);
                }
                dateStoriesMap.get(story.date).push(story);
            });

            // Calculate stats
            const sortedDates = Array.from(dateStoriesMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
            const stats = {
                totalStories: userStories.length,
                avgPerDay: (userStories.length / Math.max(sortedDates.length, 1)).toFixed(1),
                avgPerWeek: (userStories.length / Math.max(sortedDates.length / 7, 1)).toFixed(1)
            };

            // Create expandable user item
            const userItem = document.createElement('div');
            userItem.className = 'user-list-item';
            
            const profilePic = this.getProfilePicture(username);
            const avatarContent = this.generateAvatarContent(username, profilePic);
            
            userItem.innerHTML = `
                <div class="user-list-header">
                    <div class="user-list-avatar" style="${avatarContent.style}">${avatarContent.letter}</div>
                    <div class="user-list-details">
                        <div class="user-list-name">${username}</div>
                        <div class="user-list-stats">
                            Total Reshares: ${stats.totalStories} • Avg/Day: ${stats.avgPerDay} • Avg/Week: ${stats.avgPerWeek} • ${sortedDates.length} dates
                        </div>
                    </div>
                    <div class="user-expand-icon">▶</div>
                </div>
                <div class="user-dates-container">
                    <div class="user-inline-dates" id="reshare-dates-${username}">
                        <!-- Dates will be populated here -->
                    </div>
                </div>
            `;

            // Add expand/collapse functionality
            const header = userItem.querySelector('.user-list-header');
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleReshareUserExpansion(userItem, username, sortedDates);
            });

            resharesList.appendChild(userItem);
        });
    }

    toggleReshareUserExpansion(userItem, username, sortedDates) {
        const isExpanded = userItem.classList.contains('expanded');
        
        if (isExpanded) {
            // Collapse
            userItem.classList.remove('expanded');
        } else {
            // Expand and populate dates if not already done
            userItem.classList.add('expanded');
            
            const datesContainer = userItem.querySelector(`#reshare-dates-${username}`);
            if (datesContainer.children.length === 0) {
                this.populateReshareInlineDates(datesContainer, username, sortedDates);
            }
        }
    }
    
    populateReshareInlineDates(container, username, sortedDates) {
        sortedDates.forEach(([date, dateStories]) => {
            const dateItem = document.createElement('div');
            dateItem.className = 'user-inline-date';
            
            // Format YYYYMMDD to readable date
            const year = date.substring(0, 4);
            const month = date.substring(4, 6);
            const day = date.substring(6, 8);
            const formattedDate = new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
            
            const imageCount = dateStories.filter(s => s.type === 'image').length;
            const videoCount = dateStories.filter(s => s.type === 'video').length;
            
            // Build stats text
            const stats = [];
            if (imageCount > 0) stats.push(`${imageCount} photos`);
            if (videoCount > 0) stats.push(`${videoCount} videos`);
            const statsText = stats.join(' • ');
            
            dateItem.innerHTML = `
                <div class="user-inline-date-content">
                    <div class="user-inline-date-info">
                        <div class="user-inline-date-name">${formattedDate}</div>
                        <div class="user-inline-date-stats">${dateStories.length} reshares${statsText ? ' • ' + statsText : ''}</div>
                    </div>
                </div>
                <div class="user-inline-date-arrow">→</div>
            `;
            
            dateItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openReshareStoriesForUserDate(username, dateStories);
            });
            
            container.appendChild(dateItem);
        });
    }
    
    openReshareStoriesForUserDate(originalUsername, dateStories) {
        // Sort stories chronologically
        const sortedStories = [...dateStories].sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return (a.filename || '').localeCompare(b.filename || '');
        });
        
        // Remove duplicates based on filename to prevent repeats
        const uniqueStories = [];
        const seenFilenames = new Set();
        
        for (const story of sortedStories) {
            const key = `${story.filename}_${story.date}`;
            if (!seenFilenames.has(key)) {
                seenFilenames.add(key);
                uniqueStories.push(story);
            }
        }
        
        // Create a single group showing the original username in the header
        this.groupedStories = [{
            username: originalUsername, // Show original username
            stories: uniqueStories
        }];
        this.currentGroupIndex = 0;
        this.currentStories = uniqueStories;
        this.currentStoryIndex = 0;
        this.showStoryModal();
    }

    openSpecificReshareStory(story) {
        // Create a single-story group
        this.groupedStories = [{
            username: 'medicalmedium',
            stories: [story]
        }];
        this.currentGroupIndex = 0;
        this.currentStories = [story];
        this.currentStoryIndex = 0;
        this.showStoryModal();
    }

    showResharesBySpecificUser(username) {
        // Filter reshare stories by specific original user
        const medicalMediumStories = this.userStories.get('medicalmedium') || [];
        const userReshares = medicalMediumStories.filter(story => 
            story.reshareInfo && story.reshareInfo.originalUser === username
        );

        if (userReshares.length === 0) return;

        // Sort chronologically
        const sortedStories = [...userReshares].sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.filename.localeCompare(b.filename);
        });

        // Open in story viewer
        this.groupedStories = [{
            username: 'medicalmedium',
            stories: sortedStories
        }];
        this.currentGroupIndex = 0;
        this.currentStories = sortedStories;
        this.currentStoryIndex = 0;
        this.showStoryModal();
    }

    renderResharedUsersStories(sortType = 'newest') {
        const storiesList = document.getElementById('reshared-users-stories-list');
        if (!storiesList) return;

        storiesList.innerHTML = '';
        storiesList.className = 'dates-list';

        if (this.resharedUsersStories.size === 0) {
            storiesList.innerHTML = `
                <div class="empty-analytics">
                    <div class="empty-analytics-icon">📚</div>
                    <div class="empty-analytics-title">No Reshared Users' Stories</div>
                    <div>No stories found from reshared users</div>
                </div>
            `;
            return;
        }

        // Sort dates based on sortType
        let sortedDates;
        if (sortType === 'oldest') {
            sortedDates = Array.from(this.resharedUsersStories.keys()).sort((a, b) => a.localeCompare(b));
        } else {
            // Default to newest first
            sortedDates = Array.from(this.resharedUsersStories.keys()).sort((a, b) => b.localeCompare(a));
        }

        sortedDates.forEach(date => {
            const stories = this.resharedUsersStories.get(date);

            // Format YYYYMMDD to readable date
            const year = date.substring(0, 4);
            const month = date.substring(4, 6);
            const day = date.substring(6, 8);
            const formattedDate = new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });

            // Group stories by user
            const userStoriesMap = new Map();
            stories.forEach(story => {
                if (!userStoriesMap.has(story.username)) {
                    userStoriesMap.set(story.username, []);
                }
                userStoriesMap.get(story.username).push(story);
            });

            // Sort users by story count (descending), then alphabetically
            const sortedUsers = Array.from(userStoriesMap.entries()).sort((a, b) => {
                const countDiff = b[1].length - a[1].length;
                if (countDiff !== 0) return countDiff;
                return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
            });

            // Create expandable date item
            const dateItem = document.createElement('div');
            dateItem.className = 'date-list-item';

            const uniqueUsers = new Set(stories.map(s => s.username));

            dateItem.innerHTML = `
                <div class="date-list-header">
                    <div class="date-list-info">
                        <div class="date-list-title">${formattedDate}</div>
                        <div class="date-list-subtitle">${stories.length} stories from ${uniqueUsers.size} reshared users</div>
                    </div>
                    <div class="date-expand-icon">▶</div>
                </div>
                <div class="date-users-container">
                    <div class="date-inline-users" id="reshared-users-${date}">
                        <!-- Users will be populated here -->
                    </div>
                </div>
            `;

            // Add expand/collapse functionality
            const header = dateItem.querySelector('.date-list-header');
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleResharedUsersDateExpansion(dateItem, date, sortedUsers);
            });

            storiesList.appendChild(dateItem);
        });
    }

    toggleResharedUsersDateExpansion(dateItem, date, sortedUsers) {
        const isExpanded = dateItem.classList.contains('expanded');

        if (isExpanded) {
            // Collapse
            dateItem.classList.remove('expanded');
        } else {
            // Expand and populate users if not already done
            dateItem.classList.add('expanded');

            const usersContainer = dateItem.querySelector(`#reshared-users-${date}`);
            if (usersContainer.children.length === 0) {
                this.populateResharedUsersInline(usersContainer, sortedUsers);
            }
        }
    }

    populateResharedUsersInline(container, sortedUsers) {
        sortedUsers.forEach(([username, userStories]) => {
            const userItem = document.createElement('div');
            userItem.className = 'date-inline-user';

            const profilePic = this.getProfilePicture(username);
            const imageCount = userStories.filter(s => s.type === 'image').length;
            const videoCount = userStories.filter(s => s.type === 'video').length;
            const avatarContent = this.generateAvatarContent(username, profilePic);

            // Build stats text
            const stats = [];
            if (imageCount > 0) stats.push(`${imageCount} photos`);
            if (videoCount > 0) stats.push(`${videoCount} videos`);
            const statsText = stats.join(' • ');

            userItem.innerHTML = `
                <div class="date-inline-user-content">
                    <div class="date-inline-avatar" style="${avatarContent.style}">${avatarContent.letter}</div>
                    <div class="date-inline-info">
                        <div class="date-inline-name">${username}</div>
                        <div class="date-inline-stats">${userStories.length} stories${statsText ? ' • ' + statsText : ''}</div>
                    </div>
                </div>
            `;

            userItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openResharedUserStories(username, userStories);
            });

            container.appendChild(userItem);
        });
    }
    
    openResharedUserStories(originalUsername, userStories) {
        // Sort stories chronologically
        const sortedStories = [...userStories].sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return (a.filename || '').localeCompare(b.filename || '');
        });
        
        // Remove duplicates based on filename to prevent repeats
        const uniqueStories = [];
        const seenFilenames = new Set();
        
        for (const story of sortedStories) {
            const key = `${story.filename}_${story.date}`;
            if (!seenFilenames.has(key)) {
                seenFilenames.add(key);
                uniqueStories.push(story);
            }
        }
        
        // Create a single group showing the original username in the header
        this.groupedStories = [{
            username: originalUsername, // Show original username (e.g., "healthyliving123")
            stories: uniqueStories
        }];
        this.currentGroupIndex = 0;
        this.currentStories = uniqueStories;
        this.currentStoryIndex = 0;
        this.showStoryModal();
    }

    generateAvatarContent(username, profilePic) {
        // If there's a profile picture, use it
        if (profilePic) {
            return {
                style: `background-image: url('${profilePic}');`,
                letter: ''
            };
        }

        // Generate a consistent color based on username
        const colors = [
            ['#FF6B6B', '#FF8E8E'], // Red gradient
            ['#4ECDC4', '#6BD5CB'], // Teal gradient
            ['#45B7D1', '#6CC5DC'], // Blue gradient
            ['#96CEB4', '#A8D5C4'], // Green gradient
            ['#FECA57', '#FEDB7A'], // Yellow gradient
            ['#FF9FF3', '#FFA9F5'], // Pink gradient
            ['#54A0FF', '#6AA8FF'], // Light blue gradient
            ['#5F27CD', '#7A4AD6'], // Purple gradient
            ['#00D2D3', '#33DADB'], // Cyan gradient
            ['#FF9F43', '#FFB366'], // Orange gradient
            ['#686DE0', '#7F84E5'], // Indigo gradient
            ['#4834D4', '#6550DD'], // Deep purple gradient
            ['#00A085', '#33B29A'], // Emerald gradient
            ['#FC5C65', '#FC7F85'], // Coral gradient
            ['#26DE81', '#52E59A'], // Mint gradient
            ['#A55EEA', '#B777EE'], // Violet gradient
            ['#3742FA', '#5B6CFC'], // Electric blue gradient
            ['#2F3542', '#4A4D5A'], // Dark gradient
            ['#F39801', '#F5B041'], // Amber gradient
            ['#E74C3C', '#EC7063']  // Crimson gradient
        ];

        // Create a simple hash from the username
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Use the hash to pick a color palette
        const colorIndex = Math.abs(hash) % colors.length;
        const [color1, color2] = colors[colorIndex];

        // Get the first letter of the username
        const firstLetter = username.charAt(0).toUpperCase();

        return {
            style: `background: linear-gradient(135deg, ${color1}, ${color2}); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1.2rem;`,
            letter: firstLetter
        };
    }

    addChartHoverEffects(canvas, top15Users, colors, userTimelineData, sortedDates, padding, chartWidth, chartHeight, maxCount) {
        let hoveredUser = null;
        
        // Remove existing listeners
        canvas.removeEventListener('mousemove', canvas.hoverHandler);
        canvas.removeEventListener('mouseleave', canvas.leaveHandler);

        canvas.hoverHandler = (event) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // Check if mouse is over legend
            const legendX = padding + chartWidth + 20;
            let newHoveredUser = null;

            top15Users.forEach((username, userIndex) => {
                const legendY = padding + userIndex * 18;
                if (mouseX >= legendX && mouseX <= legendX + 120 && 
                    mouseY >= legendY && mouseY <= legendY + 12) {
                    newHoveredUser = username;
                }
            });

            if (newHoveredUser !== hoveredUser) {
                hoveredUser = newHoveredUser;
                this.redrawChart(canvas, top15Users, colors, userTimelineData, sortedDates, padding, chartWidth, chartHeight, maxCount, hoveredUser);
            }
        };

        canvas.leaveHandler = () => {
            if (hoveredUser !== null) {
                hoveredUser = null;
                this.redrawChart(canvas, top15Users, colors, userTimelineData, sortedDates, padding, chartWidth, chartHeight, maxCount, null);
            }
        };

        canvas.addEventListener('mousemove', canvas.hoverHandler);
        canvas.addEventListener('mouseleave', canvas.leaveHandler);
    }

    redrawChart(canvas, top15Users, colors, userTimelineData, sortedDates, padding, chartWidth, chartHeight, maxCount, hoveredUser) {
        const ctx = canvas.getContext('2d');
        
        // Clear and redraw background
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw axes
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + chartHeight);
        ctx.lineTo(padding + chartWidth, padding + chartHeight);
        ctx.stroke();

        // Draw lines with hover effect
        top15Users.forEach((username, userIndex) => {
            const timeline = userTimelineData.get(username);
            if (!timeline) return;

            const color = colors[userIndex % colors.length];
            const isHovered = hoveredUser === username;
            const isOtherHovered = hoveredUser && hoveredUser !== username;
            
            ctx.strokeStyle = isOtherHovered ? `${color}40` : color; // 40 = 25% opacity
            ctx.fillStyle = isOtherHovered ? `${color}40` : color;
            ctx.lineWidth = isHovered ? 4 : 2;
            ctx.beginPath();

            let firstPoint = true;
            sortedDates.forEach((date, dateIndex) => {
                const count = timeline.get(date) || 0;
                const x = padding + (dateIndex / (sortedDates.length - 1)) * chartWidth;
                const y = padding + chartHeight - (count / maxCount) * chartHeight;

                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }

                // Draw point (larger if hovered)
                const pointSize = isHovered ? 4 : 2;
                ctx.fillRect(x - pointSize, y - pointSize, pointSize * 2, pointSize * 2);
            });

            ctx.stroke();

            // Draw legend item
            const legendX = padding + chartWidth + 20;
            const legendY = padding + userIndex * 18;
            
            ctx.fillStyle = isOtherHovered ? `${color}60` : color;
            ctx.fillRect(legendX, legendY, 12, 12);
            ctx.fillStyle = isOtherHovered ? '#80808060' : '#808080';
            ctx.font = isHovered ? 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif' : '11px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(username, legendX + 18, legendY + 9);
        });

        // Draw y-axis labels
        ctx.fillStyle = '#a0a0a0';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const value = (maxCount * i / 5).toFixed(0);
            const y = padding + chartHeight - (i / 5) * chartHeight;
            ctx.fillText(value, padding - 10, y + 4);
        }

        // Draw x-axis labels
        ctx.textAlign = 'center';
        if (sortedDates.length >= 3) {
            [0, Math.floor(sortedDates.length / 2), sortedDates.length - 1].forEach(index => {
                const date = sortedDates[index];
                const x = padding + (index / (sortedDates.length - 1)) * chartWidth;
                const formattedDate = `${date.substring(4, 6)}/${date.substring(6, 8)}`;
                ctx.fillText(formattedDate, x, canvas.height - padding + 15);
            });
        }
    }
    
    initializeUpdateStatus() {        
        this.updateScheduleInfo();
        // Update every minute
        setInterval(() => this.updateScheduleInfo(), 60000);
    }
    
    showUpdateBubble() {
        const bubble = document.getElementById('update-status-bubble');
        const content = bubble.querySelector('.update-status-content');
        
        if (bubble.classList.contains('collapsed')) {
            // Start expanding the bubble
            bubble.classList.remove('collapsed');
            bubble.classList.add('pulse-green');
            
            // Show content after bubble width transition completes (300ms)
            setTimeout(() => {
                content.style.opacity = '1';
                content.style.visibility = 'visible';
            }, 300);
            
            // Remove pulse animation after it completes
            setTimeout(() => {
                bubble.classList.remove('pulse-green');
            }, 800);
            
            // Auto-close after 3 seconds
            setTimeout(() => {
                this.closeBubble();
            }, 3000);
        }
    }
    
    closeBubble() {
        const bubble = document.getElementById('update-status-bubble');
        const content = bubble.querySelector('.update-status-content');
        
        // Hide content first
        content.style.opacity = '0';
        content.style.visibility = 'hidden';
        
        // Collapse bubble after content fades out
        setTimeout(() => {
            bubble.classList.add('collapsed');
            // Reset for next time
            setTimeout(() => {
                content.style.opacity = '';
                content.style.visibility = '';
            }, 300);
        }, 200);
    }
    
    async getServerTime() {
        try {
            // Try to get server time from API
            const response = await fetch('/api.php?action=server-time');
            if (response.ok) {
                const data = await response.json();
                return new Date(data.timestamp * 1000);
            }
        } catch (error) {
            console.log('Server time not available, using client time');
        }
        // Fallback to client time
        return new Date();
    }
    
    async updateScheduleInfo() {
        const now = await this.getServerTime();
        
        // Medical Medium schedule: 7:30 AM, 4:30 PM, 11:30 PM
        const mmSchedule = [
            { hour: 7, minute: 30 },
            { hour: 16, minute: 30 },
            { hour: 23, minute: 30 }
        ];
        
        // VIP List schedule: 10:30 AM, 10:30 PM
        const vipSchedule = [
            { hour: 10, minute: 30 },
            { hour: 22, minute: 30 }
        ];
        
        // Reshared Users schedule: 1:05 AM
        const reshareSchedule = [
            { hour: 1, minute: 5 }
        ];
        
        // Update each group
        this.updateGroupTimes('mm', mmSchedule, now);
        this.updateGroupTimes('vip', vipSchedule, now);
        this.updateGroupTimes('reshare', reshareSchedule, now);
    }
    
    updateGroupTimes(groupId, schedule, now) {
        const { last, next } = this.calculateUpdateTimes(schedule, now);
        
        // Update DOM
        const lastElement = document.getElementById(`${groupId}-last-update`);
        const nextElement = document.getElementById(`${groupId}-next-update`);
        const statusIndicator = document.getElementById(`${groupId}-status`);
        
        // Check if currently updating (within 5 minutes of scheduled time)
        const isUpdating = this.isCurrentlyUpdating(schedule, now);
        
        if (statusIndicator) {
            if (isUpdating) {
                statusIndicator.classList.add('updating');
                if (lastElement) {
                    lastElement.textContent = 'updating now...';
                    lastElement.parentElement.classList.add('flash');
                }
            } else {
                statusIndicator.classList.remove('updating');
                if (lastElement) {
                    lastElement.textContent = this.formatUpdateTime(last);
                    // Add flash animation when last update changes
                    lastElement.parentElement.classList.add('flash');
                    setTimeout(() => {
                        lastElement.parentElement.classList.remove('flash');
                    }, 2000);
                }
            }
        }
        
        if (nextElement && !isUpdating) {
            nextElement.textContent = this.formatUpdateTime(next);
        }
    }
    
    isCurrentlyUpdating(schedule, now) {
        // Check if we're within 5 minutes of any scheduled run time
        for (const time of schedule) {
            const scheduledTime = new Date(now);
            scheduledTime.setHours(time.hour, time.minute, 0, 0);
            
            const diffMs = Math.abs(now - scheduledTime);
            const diffMinutes = diffMs / (1000 * 60);
            
            // If within 5 minutes of scheduled time
            if (diffMinutes <= 5) {
                return true;
            }
        }
        return false;
    }
    
    calculateUpdateTimes(schedule, now) {
        const todayRuns = [];
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Create today's run times
        schedule.forEach(time => {
            const runTime = new Date(now);
            runTime.setHours(time.hour, time.minute, 0, 0);
            todayRuns.push(runTime);
        });
        
        // Find last and next runs
        let lastRun = null;
        let nextRun = null;
        
        for (let i = 0; i < todayRuns.length; i++) {
            if (todayRuns[i] <= now) {
                lastRun = todayRuns[i];
            } else {
                nextRun = todayRuns[i];
                break;
            }
        }
        
        // If no next run today, use tomorrow's first run
        if (!nextRun) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(schedule[0].hour, schedule[0].minute, 0, 0);
            nextRun = tomorrow;
        }
        
        // If no last run today, use yesterday's last run
        if (!lastRun) {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(schedule[schedule.length - 1].hour, schedule[schedule.length - 1].minute, 0, 0);
            lastRun = yesterday;
        }
        
        return { last: lastRun, next: nextRun };
    }
    
    formatUpdateTime(date) {
        const now = new Date();
        const diffMs = Math.abs(now - date);
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        
        // Get the actual time in AM/PM format
        const actualTime = date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        
        if (date > now) {
            // Future time
            if (diffMinutes < 60) {
                return `in ${diffMinutes}m (${actualTime})`;
            } else if (diffHours < 24) {
                const mins = diffMinutes % 60;
                return `in ${diffHours}h ${mins}m (${actualTime})`;
            } else {
                return actualTime;
            }
        } else {
            // Past time
            if (diffMinutes < 60) {
                return `${diffMinutes}m ago (${actualTime})`;
            } else if (diffHours < 24) {
                return `${diffHours}h ago (${actualTime})`;
            } else {
                return actualTime;
            }
        }
    }
}

// Global function for toggle button
function toggleUpdateStatus() {
    const bubble = document.getElementById('update-status-bubble');
    const content = bubble.querySelector('.update-status-content');
    
    if (bubble.classList.contains('collapsed')) {
        // Opening the bubble
        bubble.classList.remove('collapsed');
        
        // Show content after bubble width transition completes (300ms)
        setTimeout(() => {
            content.style.opacity = '1';
            content.style.visibility = 'visible';
        }, 300);
    } else {
        // Closing the bubble
        window.storyExplorer.closeBubble();
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const app = new StoryArchiveExplorer();
    window.storyExplorer = app;
    
    // Auto-load if configured
    if (window.SERVER_CONFIG && window.SERVER_CONFIG.AUTO_LOAD && window.SERVER_CONFIG.SERVER_MODE) {
        setTimeout(() => {
            app.tryAutoLoad();
        }, 100); // Small delay to ensure UI is ready
    }
});