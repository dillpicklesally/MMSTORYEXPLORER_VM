<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Archive path configuration - mounted NFS location
$archivePath = '/var/www/story-archive/archive';
if (php_sapi_name() === 'cli-server' || isset($_SERVER['LOCAL_DEV']) || $_SERVER['SERVER_NAME'] === 'localhost') {
    $archivePath = '/var/www/story-archive/archive';
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list-dates':
        listDates();
        break;
    case 'list-stories':
        $date = $_GET['date'] ?? '';
        if ($date) {
            listStories($date);
        }
        break;
    case 'get-file':
        $path = $_GET['path'] ?? '';
        if ($path) {
            serveFile($path);
        }
        break;
    case 'list-avatars':
        listAvatars();
        break;
    case 'test-debug':
        echo json_encode(['message' => 'NEW API FILE IS BEING USED', 'timestamp' => date('Y-m-d H:i:s')]);
        break;
    case 'list-profile-snapshots':
        listProfileSnapshots();
        break;
    case 'list-reshared-users-stories':
        listResharedUsersStories();
        break;
    case 'process-video':
        error_log("API: process-video action triggered - NEW VERSION");
        $inputPath = $_POST['input_path'] ?? '';
        $overlayPng = $_FILES['overlay_png'] ?? null;
        if ($inputPath && $overlayPng) {
            processVideoWithOverlay($inputPath, $overlayPng);
        } else {
            echo json_encode(['error' => 'Missing required parameters: input_path and overlay_png']);
        }
        break;
    case 'concatenate-videos':
        error_log("API: concatenate-videos action triggered");
        $videoCount = intval($_POST['video_count'] ?? 0);
        $outputFilename = $_POST['output_filename'] ?? 'concatenated_output.mp4';
        
        if ($videoCount > 0) {
            // Collect all video files
            $videoFiles = [];
            for ($i = 0; $i < $videoCount; $i++) {
                if (isset($_FILES["video_$i"])) {
                    $videoFiles[] = $_FILES["video_$i"];
                }
            }
            
            if (count($videoFiles) === $videoCount) {
                concatenateVideos($videoFiles, $outputFilename);
            } else {
                echo json_encode(['error' => "Expected $videoCount video files, received " . count($videoFiles)]);
            }
        } else {
            echo json_encode(['error' => 'Invalid video count']);
        }
        break;
    case 'export-visual-experience':
        error_log("API: export-visual-experience action triggered");
        $storyPaths = json_decode($_POST['story_paths'] ?? '[]', true);
        $outputFilename = $_POST['output_filename'] ?? 'visual_experience.mp4';
        
        if (!empty($storyPaths)) {
            exportVisualExperienceServerSide($storyPaths, $outputFilename);
        } else {
            echo json_encode(['error' => 'No story paths provided']);
        }
        break;
    case 'export-visual-experience-with-overlays':
        error_log("API: export-visual-experience-with-overlays action triggered");
        $storySegments = json_decode($_POST['story_segments'] ?? '[]', true);
        $outputFilename = $_POST['output_filename'] ?? 'visual_experience.mp4';
        
        if (!empty($storySegments)) {
            exportVisualExperienceWithOverlays($storySegments, $outputFilename);
        } else {
            echo json_encode(['error' => 'No story segments provided']);
        }
        break;
    default:
        echo json_encode(['error' => 'Invalid action']);
}

function listDates() {
    global $archivePath;
    $dates = [];
    
    if (is_dir($archivePath)) {
        $dirs = scandir($archivePath);
        foreach ($dirs as $dir) {
            if (preg_match('/^\d{8}$/', $dir)) {
                $dates[] = $dir;
            }
        }
    }
    
    rsort($dates);
    echo json_encode($dates);
}

function listStories($date) {
    global $archivePath;
    $stories = [];
    $dateDir = "$archivePath/$date";
    
    if (!is_dir($dateDir)) {
        echo json_encode([]);
        return;
    }
    
    $users = scandir($dateDir);
    foreach ($users as $user) {
        if ($user === '.' || $user === '..' || $user === 'AccountCaptures') continue;
        
        $userDir = "$dateDir/$user";
        if (!is_dir($userDir)) continue;
        
        $files = scandir($userDir);
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') continue;
            
            $fullPath = "$userDir/$file";
            $relativePath = "$date/$user/$file";
            
            if (preg_match('/\.(jpg|jpeg|png|mp4)$/i', $file)) {
                $stories[] = [
                    'username' => $user,
                    'filename' => $file,
                    'path' => $relativePath,
                    'type' => preg_match('/\.mp4$/i', $file) ? 'video' : 'image',
                    'date' => $date
                ];
            }
        }
    }
    
    echo json_encode($stories);
}

function listAvatars() {
    global $archivePath;
    $avatars = [];
    $avatarDir = "$archivePath/Avatars";
    
    if (is_dir($avatarDir)) {
        $files = scandir($avatarDir);
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') continue;
            
            if (preg_match('/^(.+)_avatar_\d{8}\.(jpg|jpeg|png)$/i', $file, $matches)) {
                $username = $matches[1];
                $avatars[] = [
                    'username' => $username,
                    'filename' => $file,
                    'path' => "Avatars/$file"
                ];
            }
        }
    }
    
    echo json_encode($avatars);
}

function processVideoWithOverlay($inputPath, $overlayPngFile) {
    global $archivePath;
    error_log("processVideoWithOverlay called with inputPath: $inputPath");
    $inputFile = "$archivePath/$inputPath";
    
    if (!file_exists($inputFile)) {
        echo json_encode(['error' => 'Input file not found']);
        return;
    }
    
    // Save uploaded overlay PNG to temporary file
    $overlayFile = tempnam(sys_get_temp_dir(), 'overlay_') . '.png';
    if (!move_uploaded_file($overlayPngFile['tmp_name'], $overlayFile)) {
        echo json_encode(['error' => 'Failed to save overlay file']);
        return;
    }
    
    // Create output file
    $outputFile = tempnam(sys_get_temp_dir(), 'story_export_') . '.mp4';
    
    try {
        // Optimized overlay processing for speed
        $cmd = [
            'ffmpeg',
            '-i', escapeshellarg($inputFile),
            '-i', escapeshellarg($overlayFile),
            '-filter_complex', '[0:v][1:v]overlay=0:0',
            '-c:a', 'copy',
            '-preset', 'ultrafast', // Fastest preset for speed
            '-crf', '23', // Reasonable quality
            '-movflags', '+faststart', // Optimize for web playback
            '-y',
            escapeshellarg($outputFile)
        ];
        
        $command = implode(' ', $cmd);
        
        // Debug: Log the command being executed
        error_log("FFmpeg command: " . $command);
        
        $output = [];
        $returnCode = 0;
        
        exec($command . ' 2>&1', $output, $returnCode);
        
        if ($returnCode !== 0) {
            throw new Exception('FFmpeg processing failed: ' . implode('\n', $output));
        }
        
        if (!file_exists($outputFile) || filesize($outputFile) == 0) {
            throw new Exception('Output file was not created or is empty');
        }
        
        // Send the file
        header('Content-Type: video/mp4');
        header('Content-Disposition: attachment; filename="' . basename($inputPath, '.mp4') . '_exported.mp4"');
        header('Content-Length: ' . filesize($outputFile));
        
        readfile($outputFile);
        
    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    } finally {
        // Clean up temporary files
        if (file_exists($overlayFile)) {
            unlink($overlayFile);
        }
        if (file_exists($outputFile)) {
            unlink($outputFile);
        }
    }
}


function serveFile($path) {
    global $archivePath;
    
    // Check if this is an AutoExport path (profile snapshots)
    if (strpos($path, 'AutoExport/') === 0) {
        $fullPath = "/mnt/nfs/MM/$path";
    } else {
        $fullPath = "$archivePath/$path";
    }
    
    if (!file_exists($fullPath)) {
        http_response_code(404);
        exit;
    }
    
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $fullPath);
    finfo_close($finfo);
    
    // Set proper headers for video files (Safari compatibility)
    if (strpos($mimeType, 'video') !== false) {
        $size = filesize($fullPath);
        header("Content-Type: $mimeType");
        header("Content-Length: $size");
        header("Accept-Ranges: bytes");
        header("Cache-Control: public, max-age=3600");
        
        // Handle range requests for Safari
        if (isset($_SERVER['HTTP_RANGE'])) {
            $range = $_SERVER['HTTP_RANGE'];
            list($unit, $ranges) = explode('=', $range, 2);
            
            if ($unit == 'bytes') {
                list($range) = explode(',', $ranges, 1);
                list($start, $end) = explode('-', $range, 2);
                
                $start = intval($start);
                $end = ($end === '') ? $size - 1 : intval($end);
                $length = $end - $start + 1;
                
                header("HTTP/1.1 206 Partial Content");
                header("Content-Range: bytes $start-$end/$size");
                header("Content-Length: $length");
                
                $fp = fopen($fullPath, 'rb');
                fseek($fp, $start);
                $remaining = $length;
                while ($remaining > 0 && !feof($fp)) {
                    $read = min(8192, $remaining);
                    echo fread($fp, $read);
                    $remaining -= $read;
                    flush();
                }
                fclose($fp);
                exit;
            }
        }
    } else {
        header("Content-Type: $mimeType");
        header("Cache-Control: public, max-age=3600");
    }
    
    readfile($fullPath);
}

function listProfileSnapshots() {
    $profileSnapshots = [];
    $autoExportPath = '/mnt/nfs/MM/AutoExport';
    
    if (!is_dir($autoExportPath)) {
        echo json_encode([]);
        return;
    }
    
    // Get all date directories
    $dates = scandir($autoExportPath);
    foreach ($dates as $date) {
        if (!preg_match('/^\d{8}$/', $date)) continue; // Skip non-date folders
        
        $accountCapturesDir = "$autoExportPath/$date/AccountCaptures";
        if (!is_dir($accountCapturesDir)) continue;
        
        // Get all image files in AccountCaptures
        $files = scandir($accountCapturesDir);
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') continue;
            
            if (preg_match('/\.(jpg|jpeg|png|gif|webp)$/i', $file)) {
                // Extract username from filename
                $username = extractUsernameFromSnapshot($file);
                if ($username && 
                    $username !== 'medicalmedium' && 
                    $username !== 'cymbiotika (Co-Founder)' &&
                    stripos($username, 'cymbiotika') === false) { // Skip medicalmedium and cymbiotika
                    
                    // Normalize username to handle variations like _healingbyjane_, _healingbyjane, healingbyjane
                    $normalizedUsername = normalizeUsername($username);
                    $profileSnapshots[] = [
                        'username' => $normalizedUsername,
                        'filename' => $file,
                        'path' => "AutoExport/$date/AccountCaptures/$file",
                        'date' => $date
                    ];
                }
            }
        }
    }
    
    echo json_encode($profileSnapshots);
}

function listResharedUsersStories() {
    $resharedUsersStories = [];
    $autoExportPath = '/mnt/nfs/MM/AutoExport';
    
    if (!is_dir($autoExportPath)) {
        echo json_encode([]);
        return;
    }
    
    // Get all date directories
    $dates = scandir($autoExportPath);
    foreach ($dates as $date) {
        if (!preg_match('/^\d{8}$/', $date)) continue; // Skip non-date folders
        
        $allResharedUserStoriesDir = "$autoExportPath/$date/AllResharedUserStories";
        if (!is_dir($allResharedUserStoriesDir)) continue;
        
        // Get all username directories in AllResharedUserStories
        $userDirs = scandir($allResharedUserStoriesDir);
        foreach ($userDirs as $userDir) {
            if ($userDir === '.' || $userDir === '..') continue;
            
            $userDirPath = "$allResharedUserStoriesDir/$userDir";
            if (!is_dir($userDirPath)) continue;
            
            // Scan files within the username directory
            $files = scandir($userDirPath);
            foreach ($files as $file) {
                if ($file === '.' || $file === '..') continue;
                
                if (preg_match('/\.(jpg|jpeg|png|gif|webp|mp4)$/i', $file)) {
                    $resharedUsersStories[] = [
                        'username' => $userDir, // Use the directory name as the username
                        'filename' => $file,
                        'path' => "AutoExport/$date/AllResharedUserStories/$userDir/$file",
                        'date' => $date,
                        'type' => preg_match('/\.mp4$/i', $file) ? 'video' : 'image'
                    ];
                }
            }
        }
    }
    
    echo json_encode($resharedUsersStories);
}

function extractUsernameFromStoryFilename($filename) {
    $nameWithoutExt = pathinfo($filename, PATHINFO_FILENAME);
    
    // Try different patterns for story filenames
    // Pattern 1: username_storyid (most common)
    if (preg_match('/^(.+?)_[a-zA-Z0-9]+$/', $nameWithoutExt, $matches)) {
        return $matches[1];
    }
    
    // Pattern 2: username_date_time
    if (preg_match('/^(.+?)_\d{8}_\d{6}$/', $nameWithoutExt, $matches)) {
        return $matches[1];
    }
    
    // Pattern 3: Just return the filename without extension as fallback
    return $nameWithoutExt;
}

function normalizeUsername($username) {
    // Remove leading and trailing underscores and dots
    $normalized = trim($username, '._');
    
    // Convert to lowercase for case-insensitive matching
    return strtolower($normalized);
}

function extractUsernameFromSnapshot($filename) {
    $nameWithoutExt = pathinfo($filename, PATHINFO_FILENAME);
    
    // Try different patterns that might be used for profile snapshots
    // Pattern 1: username_profile_YYYYMMDD (most common)
    if (preg_match('/^(.+)_profile_\d{8}$/', $nameWithoutExt, $matches)) {
        return $matches[1];
    }
    
    // Pattern 2: username_profile_YYYYMMDD_HHMMSS
    if (preg_match('/^(.+)_profile_\d{8}_\d{6}$/', $nameWithoutExt, $matches)) {
        return $matches[1];
    }
    
    // Pattern 3: username_YYYYMMDD_HHMMSS (generic pattern)
    if (preg_match('/^(.+)_\d{8}_\d{6}$/', $nameWithoutExt, $matches)) {
        return $matches[1];
    }
    
    // Pattern 4: username_account_YYYYMMDD
    if (preg_match('/^(.+)_account_\d{8}$/', $nameWithoutExt, $matches)) {
        return $matches[1];
    }
    
    // Pattern 5: username_capture_YYYYMMDD
    if (preg_match('/^(.+)_capture_\d{8}$/', $nameWithoutExt, $matches)) {
        return $matches[1];
    }
    
    // Pattern 6: Just username if no clear pattern matches
    return $nameWithoutExt;
}

function concatenateVideos($videoFiles, $outputFilename) {
    error_log("concatenateVideos called with " . count($videoFiles) . " files");
    
    try {
        // Save all uploaded video files to temporary files
        $tempFiles = [];
        foreach ($videoFiles as $index => $videoFile) {
            $tempFile = tempnam(sys_get_temp_dir(), "concat_input_{$index}_") . '.mp4';
            if (!move_uploaded_file($videoFile['tmp_name'], $tempFile)) {
                throw new Exception("Failed to save video file $index");
            }
            $tempFiles[] = $tempFile;
            error_log("Saved video $index to: $tempFile");
        }
        
        // Create concat list file for FFmpeg
        $concatListFile = tempnam(sys_get_temp_dir(), 'concat_list_') . '.txt';
        $concatList = '';
        foreach ($tempFiles as $tempFile) {
            $concatList .= "file '" . addslashes($tempFile) . "'\n";
        }
        file_put_contents($concatListFile, $concatList);
        error_log("Created concat list file: $concatListFile");
        
        // Create output file
        $outputFile = tempnam(sys_get_temp_dir(), 'concatenated_') . '.mp4';
        
        // Build FFmpeg command for concatenation
        $cmd = [
            'ffmpeg',
            '-f', 'concat',
            '-safe', '0',
            '-i', escapeshellarg($concatListFile),
            '-c', 'copy',  // Copy streams without re-encoding for speed
            '-preset', 'fast',
            '-y',
            escapeshellarg($outputFile)
        ];
        
        $command = implode(' ', $cmd);
        error_log("FFmpeg concatenation command: $command");
        
        $output = [];
        $returnCode = 0;
        
        exec($command . ' 2>&1', $output, $returnCode);
        
        if ($returnCode !== 0) {
            throw new Exception('FFmpeg concatenation failed: ' . implode('\n', $output));
        }
        
        if (!file_exists($outputFile) || filesize($outputFile) == 0) {
            throw new Exception('Concatenated output file was not created or is empty');
        }
        
        // Send the concatenated file
        header('Content-Type: video/mp4');
        header('Content-Disposition: attachment; filename="' . basename($outputFilename) . '"');
        header('Content-Length: ' . filesize($outputFile));
        
        readfile($outputFile);
        
        error_log("Successfully concatenated " . count($videoFiles) . " videos, output size: " . filesize($outputFile));
        
    } catch (Exception $e) {
        error_log("Concatenation error: " . $e->getMessage());
        echo json_encode(['error' => $e->getMessage()]);
    } finally {
        // Clean up temporary files
        if (isset($tempFiles)) {
            foreach ($tempFiles as $tempFile) {
                if (file_exists($tempFile)) {
                    unlink($tempFile);
                }
            }
        }
        if (isset($concatListFile) && file_exists($concatListFile)) {
            unlink($concatListFile);
        }
        if (isset($outputFile) && file_exists($outputFile)) {
            unlink($outputFile);
        }
    }
}

function exportVisualExperienceServerSide($storyPaths, $outputFilename) {
    global $archivePath;
    error_log("exportVisualExperienceServerSide called with " . count($storyPaths) . " stories");
    
    try {
        $tempVideoSegments = [];
        $totalStories = count($storyPaths);
        
        // Process each story and create video segments with overlays and progress bars
        foreach ($storyPaths as $index => $storyData) {
            $inputPath = $storyData['path'];
            $inputFile = "$archivePath/$inputPath";
            
            if (!file_exists($inputFile)) {
                error_log("Input file not found: $inputFile");
                continue;
            }
            
            // Create progress info for this story
            $currentStory = $index;
            $progressInfo = [
                'currentStory' => $currentStory,
                'totalStories' => $totalStories,
                'storyProgress' => 1.0
            ];
            
            // Generate overlay with progress bars (this will be done on client-side and sent)
            // For now, create a simple overlay-less version with progress bars baked in via FFmpeg filters
            $tempSegment = tempnam(sys_get_temp_dir(), "ve_segment_{$index}_") . '.mp4';
            
            // Create a simple text overlay showing progress for now
            // Later we can enhance this with proper Instagram-style progress bars
            $progressText = sprintf("Story %d/%d", $currentStory + 1, $totalStories);
            
            // Optimize FFmpeg command for speed
            $cmd = [
                'ffmpeg',
                '-i', escapeshellarg($inputFile)
            ];
            
            // Handle images vs videos differently
            $fileExtension = strtolower(pathinfo($inputFile, PATHINFO_EXTENSION));
            if (in_array($fileExtension, ['jpg', 'jpeg', 'png', 'gif'])) {
                // For images: create 6-second video
                $cmd = array_merge($cmd, [
                    '-loop', '1',
                    '-t', '6',
                    '-pix_fmt', 'yuv420p'
                ]);
            }
            
            // Add text overlay for progress indication
            $cmd = array_merge($cmd, [
                '-vf', "drawtext=text='$progressText':fontcolor=white:fontsize=24:x=40:y=40:shadowcolor=black:shadowx=1:shadowy=1",
                '-c:a', 'copy',
                '-preset', 'ultrafast', // Fastest preset for speed
                '-crf', '23', // Reasonable quality
                '-y',
                escapeshellarg($tempSegment)
            ]);
            
            $command = implode(' ', $cmd);
            error_log("Processing segment $index: $command");
            
            $output = [];
            $returnCode = 0;
            exec($command . ' 2>&1', $output, $returnCode);
            
            if ($returnCode !== 0) {
                error_log("Failed to process segment $index: " . implode('\n', $output));
                continue;
            }
            
            if (file_exists($tempSegment) && filesize($tempSegment) > 0) {
                $tempVideoSegments[] = $tempSegment;
                error_log("Successfully created segment $index: " . filesize($tempSegment) . " bytes");
            }
        }
        
        if (empty($tempVideoSegments)) {
            throw new Exception('No video segments were created successfully');
        }
        
        // Create concat list file
        $concatListFile = tempnam(sys_get_temp_dir(), 've_concat_list_') . '.txt';
        $concatList = '';
        foreach ($tempVideoSegments as $tempSegment) {
            $concatList .= "file '" . addslashes($tempSegment) . "'\n";
        }
        file_put_contents($concatListFile, $concatList);
        error_log("Created concat list with " . count($tempVideoSegments) . " segments");
        
        // Create final output file
        $outputFile = tempnam(sys_get_temp_dir(), 'visual_experience_') . '.mp4';
        
        // Concatenate all segments with optimized settings
        $concatCmd = [
            'ffmpeg',
            '-f', 'concat',
            '-safe', '0',
            '-i', escapeshellarg($concatListFile),
            '-c', 'copy', // Copy streams for speed
            '-avoid_negative_ts', 'make_zero', // Fix potential timestamp issues
            '-fflags', '+genpts', // Generate presentation timestamps
            '-y',
            escapeshellarg($outputFile)
        ];
        
        $concatCommand = implode(' ', $concatCmd);
        error_log("Final concatenation: $concatCommand");
        
        $output = [];
        $returnCode = 0;
        exec($concatCommand . ' 2>&1', $output, $returnCode);
        
        if ($returnCode !== 0) {
            throw new Exception('Final concatenation failed: ' . implode('\n', $output));
        }
        
        if (!file_exists($outputFile) || filesize($outputFile) == 0) {
            throw new Exception('Final output file was not created or is empty');
        }
        
        // Send the final video
        header('Content-Type: video/mp4');
        header('Content-Disposition: attachment; filename="' . basename($outputFilename) . '"');
        header('Content-Length: ' . filesize($outputFile));
        
        readfile($outputFile);
        
        error_log("Successfully created Visual Experience: " . filesize($outputFile) . " bytes");
        
    } catch (Exception $e) {
        error_log("Visual Experience export error: " . $e->getMessage());
        echo json_encode(['error' => $e->getMessage()]);
    } finally {
        // Clean up all temporary files
        if (isset($tempVideoSegments)) {
            foreach ($tempVideoSegments as $tempSegment) {
                if (file_exists($tempSegment)) {
                    unlink($tempSegment);
                }
            }
        }
        if (isset($concatListFile) && file_exists($concatListFile)) {
            unlink($concatListFile);
        }
        if (isset($outputFile) && file_exists($outputFile)) {
            unlink($outputFile);
        }
    }
}

function sendProgressUpdate($progress, $message) {
    // Send progress update to client via error log for now
    // In production, this could use Server-Sent Events or WebSocket
    error_log("PROGRESS: {$progress}% - {$message}");
    
    // Flush output to ensure progress is sent immediately
    if (ob_get_level()) {
        ob_flush();
    }
    flush();
}

function createFallbackVideoSegment($index) {
    $tempSegment = tempnam(sys_get_temp_dir(), "ve_fallback_{$index}_") . '.mp4';
    
    // Create a 6-second black video as fallback
    $cmd = [
        'ffmpeg',
        '-f', 'lavfi',
        '-i', 'color=black:size=1080x1920:duration=6:rate=30',
        '-vf', "drawtext=text='Missing Video':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2",
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-y',
        escapeshellarg($tempSegment)
    ];
    
    $command = implode(' ', $cmd);
    error_log("Creating fallback segment: " . $command);
    
    $output = [];
    $returnCode = 0;
    exec($command . ' 2>&1', $output, $returnCode);
    
    if ($returnCode === 0 && file_exists($tempSegment) && filesize($tempSegment) > 0) {
        return $tempSegment;
    } else {
        error_log("Failed to create fallback segment: " . implode('\n', $output));
        if (file_exists($tempSegment)) {
            unlink($tempSegment);
        }
        return null;
    }
}

function processSegmentWithoutOverlay($inputFile, $index) {
    $tempSegment = tempnam(sys_get_temp_dir(), "ve_no_overlay_{$index}_") . '.mp4';
    
    // Build FFmpeg command without overlay
    $cmd = [
        'ffmpeg',
        '-i', escapeshellarg($inputFile)
    ];
    
    // Handle images vs videos differently
    $fileExtension = strtolower(pathinfo($inputFile, PATHINFO_EXTENSION));
    if (in_array($fileExtension, ['jpg', 'jpeg', 'png', 'gif'])) {
        // For images: create 6-second video with loop
        $cmd = array_merge($cmd, [
            '-loop', '1',
            '-t', '6',
            '-pix_fmt', 'yuv420p'
        ]);
    }
    
    // Add encoding settings
    $cmd = array_merge($cmd, [
        '-c:a', 'copy',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-movflags', '+faststart',
        '-y',
        escapeshellarg($tempSegment)
    ]);
    
    $command = implode(' ', $cmd);
    error_log("Processing segment without overlay: " . $command);
    
    $output = [];
    $returnCode = 0;
    exec($command . ' 2>&1', $output, $returnCode);
    
    if ($returnCode === 0 && file_exists($tempSegment) && filesize($tempSegment) > 0) {
        return $tempSegment;
    } else {
        error_log("Failed to process segment without overlay: " . implode('\n', $output));
        if (file_exists($tempSegment)) {
            unlink($tempSegment);
        }
        return null;
    }
}

function exportVisualExperienceWithOverlays($storySegments, $outputFilename) {
    global $archivePath;
    error_log("exportVisualExperienceWithOverlays called with " . count($storySegments) . " segments");
    
    // Send initial progress update
    sendProgressUpdate(0, "Starting Visual Experience export...");
    
    try {
        $tempVideoSegments = [];
        $totalSegments = count($storySegments);
        
        // Process each story segment with its overlay
        foreach ($storySegments as $index => $segmentData) {
            $progress = (($index + 1) / $totalSegments) * 80; // Reserve last 20% for concatenation
            sendProgressUpdate($progress, "Processing segment " . ($index + 1) . " of $totalSegments");
            
            $inputPath = $segmentData['path'];
            $inputFile = "$archivePath/$inputPath";
            
            if (!file_exists($inputFile)) {
                error_log("Input file not found: $inputFile - creating fallback segment");
                // Create a black fallback video instead of skipping
                $tempSegment = createFallbackVideoSegment($index);
                if ($tempSegment) {
                    $tempVideoSegments[] = $tempSegment;
                }
                continue;
            }
            
            // Get the overlay PNG for this segment
            $overlayKey = "overlay_{$index}";
            if (!isset($_FILES[$overlayKey])) {
                error_log("Overlay not found for segment $index - processing without overlay");
                // Process without overlay instead of skipping
                $tempSegment = processSegmentWithoutOverlay($inputFile, $index);
                if ($tempSegment) {
                    $tempVideoSegments[] = $tempSegment;
                }
                continue;
            }
            
            // Save uploaded overlay PNG to temporary file
            $overlayFile = tempnam(sys_get_temp_dir(), "ve_overlay_{$index}_") . '.png';
            if (!move_uploaded_file($_FILES[$overlayKey]['tmp_name'], $overlayFile)) {
                error_log("Failed to save overlay for segment $index - processing without overlay");
                // Process without overlay instead of skipping
                $tempSegment = processSegmentWithoutOverlay($inputFile, $index);
                if ($tempSegment) {
                    $tempVideoSegments[] = $tempSegment;
                }
                continue;
            }
            
            $tempSegment = tempnam(sys_get_temp_dir(), "ve_segment_{$index}_") . '.mp4';
            
            // Build FFmpeg command with overlay
            $cmd = [
                'ffmpeg',
                '-i', escapeshellarg($inputFile),
                '-i', escapeshellarg($overlayFile),
                '-filter_complex', '[0:v][1:v]overlay=0:0'
            ];
            
            // Handle images vs videos differently  
            $fileExtension = strtolower(pathinfo($inputFile, PATHINFO_EXTENSION));
            if (in_array($fileExtension, ['jpg', 'jpeg', 'png', 'gif'])) {
                // For images: create 6-second video with loop
                array_splice($cmd, 1, 0, ['-loop', '1']);
                $cmd = array_merge($cmd, [
                    '-t', '6',
                    '-pix_fmt', 'yuv420p'
                ]);
            }
            
            // Add optimized encoding settings
            $cmd = array_merge($cmd, [
                '-c:a', 'copy',
                '-preset', 'ultrafast',
                '-crf', '23',
                '-movflags', '+faststart',
                '-y',
                escapeshellarg($tempSegment)
            ]);
            
            $command = implode(' ', $cmd);
            error_log("Processing VE segment $index with overlay: " . $command);
            
            $output = [];
            $returnCode = 0;
            exec($command . ' 2>&1', $output, $returnCode);
            
            if ($returnCode !== 0) {
                error_log("Failed to process VE segment $index with overlay: " . implode('\n', $output));
                if (file_exists($overlayFile)) {
                    unlink($overlayFile);
                }
                // Try processing without overlay as fallback
                $tempSegment = processSegmentWithoutOverlay($inputFile, $index);
                if ($tempSegment) {
                    $tempVideoSegments[] = $tempSegment;
                    error_log("Successfully created fallback segment $index without overlay");
                }
                continue;
            }
            
            if (file_exists($tempSegment) && filesize($tempSegment) > 0) {
                $tempVideoSegments[] = $tempSegment;
                error_log("Successfully created VE segment $index: " . filesize($tempSegment) . " bytes");
            }
            
            // Clean up overlay file
            if (file_exists($overlayFile)) {
                unlink($overlayFile);
            }
        }
        
        if (empty($tempVideoSegments)) {
            throw new Exception('No video segments with overlays were created successfully');
        }
        
        // Create concat list file
        $concatListFile = tempnam(sys_get_temp_dir(), 've_concat_list_') . '.txt';
        $concatList = '';
        foreach ($tempVideoSegments as $tempSegment) {
            $concatList .= "file '" . addslashes($tempSegment) . "'\n";
        }
        file_put_contents($concatListFile, $concatList);
        error_log("Created VE concat list with " . count($tempVideoSegments) . " segments");
        
        // Create final output file
        $outputFile = tempnam(sys_get_temp_dir(), 'visual_experience_with_overlays_') . '.mp4';
        
        // Concatenate all segments with optimized settings
        $concatCmd = [
            'ffmpeg',
            '-f', 'concat',
            '-safe', '0',
            '-i', escapeshellarg($concatListFile),
            '-c', 'copy',
            '-avoid_negative_ts', 'make_zero',
            '-fflags', '+genpts',
            '-y',
            escapeshellarg($outputFile)
        ];
        
        $concatCommand = implode(' ', $concatCmd);
        error_log("Final VE concatenation with overlays: " . $concatCommand);
        
        $output = [];
        $returnCode = 0;
        exec($concatCommand . ' 2>&1', $output, $returnCode);
        
        if ($returnCode !== 0) {
            throw new Exception('Final VE concatenation failed: ' . implode('\n', $output));
        }
        
        sendProgressUpdate(100, "Visual Experience export completed!");
        
        if (!file_exists($outputFile) || filesize($outputFile) == 0) {
            throw new Exception('Final VE output file was not created or is empty');
        }
        
        // Send the final video
        header('Content-Type: video/mp4');
        header('Content-Disposition: attachment; filename="' . basename($outputFilename) . '"');
        header('Content-Length: ' . filesize($outputFile));
        
        readfile($outputFile);
        
        error_log("Successfully created Visual Experience with overlays: " . filesize($outputFile) . " bytes");
        
    } catch (Exception $e) {
        error_log("Visual Experience with overlays export error: " . $e->getMessage());
        echo json_encode(['error' => $e->getMessage()]);
    } finally {
        // Clean up all temporary files
        if (isset($tempVideoSegments)) {
            foreach ($tempVideoSegments as $tempSegment) {
                if (file_exists($tempSegment)) {
                    unlink($tempSegment);
                }
            }
        }
        if (isset($concatListFile) && file_exists($concatListFile)) {
            unlink($concatListFile);
        }
        if (isset($outputFile) && file_exists($outputFile)) {
            unlink($outputFile);
        }
    }
}