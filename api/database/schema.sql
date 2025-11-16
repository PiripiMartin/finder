----------------------------- USERS -----------------------------

/*
  Users table
*/
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(32) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(128) NOT NULL,
    pfp_url VARCHAR(2048) NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


/*
  User sessions table
*/
CREATE TABLE IF NOT EXISTS user_sessions(
    session_token CHAR(36) PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    /*
    ip_address VARCHAR(45), NOTE: not needed right now, can be added in if needed
    user_agent TEXT,              ^ same here.
    */
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


----------------------------- NOTIFICATIONS -----------------------------

/*
  Notifications table
*/
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


/*
  Notifications seen table (tracks which users have seen which notifications)
*/
CREATE TABLE IF NOT EXISTS notifications_seen (
    user_id INT NOT NULL,
    notification_id INT NOT NULL,
    seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, notification_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

------------------------------- MAP POINTS / LOCATIONS-------------------------------

/*
  Map points (locations) table
*/
CREATE TABLE IF NOT EXISTS map_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    google_place_id VARCHAR(255) UNIQUE, /* NOTE: UNIQUE still allows multiple nulls */
    title VARCHAR(100) NOT NULL,
    description TEXT,
    emoji VARCHAR(16) NOT NULL,
    location POINT NOT NULL,
    is_valid_location BOOLEAN NOT NULL,
    recommendable BOOLEAN NOT NULL DEFAULT FALSE,

    /* Extra business information */
    website_url VARCHAR(2048),
    phone_number VARCHAR(15),
    address TEXT,


    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    SPATIAL INDEX idx_location (location)
);


/*
  Location reviews table
*/
CREATE TABLE IF NOT EXISTS location_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    map_point_id INT NOT NULL,
    user_id INT NOT NULL,
    rating DECIMAL(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT NULL,
    like_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (map_point_id) REFERENCES map_points(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


/*
  Comments on location reviews
*/
CREATE TABLE IF NOT EXISTS location_review_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    review_id INT NOT NULL,
    commenter_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES location_reviews(id) ON DELETE CASCADE,
    FOREIGN KEY (commenter_id) REFERENCES users(id) ON DELETE CASCADE
);


/*
  Likes on location reviews
*/
CREATE TABLE IF NOT EXISTS location_review_likes (
    review_id INT NOT NULL,
    user_id INT NOT NULL,

    PRIMARY KEY (review_id, user_id),
    FOREIGN KEY (review_id) REFERENCES location_reviews(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);



/* 
  Tracks manual edits (and the resulting Google Maps location resolution) for a given location made by a given user.
*/
CREATE TABLE IF NOT EXISTS user_location_edits (
    user_id INT NOT NULL,
    map_point_id INT NOT NULL,

    google_place_id VARCHAR(255) NULL, 
    title VARCHAR(100) NULL,
    description TEXT NULL,
    emoji VARCHAR(16) NULL,
    location POINT NULL,

    website_url VARCHAR(2048) NULL,
    phone_number VARCHAR(15) NULL,
    address TEXT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, map_point_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (map_point_id) REFERENCES map_points(id)
);

/*
  Tracks locations a user has saved (per user).
*/
CREATE TABLE IF NOT EXISTS user_saved_locations (
    user_id INT NOT NULL,
    map_point_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, map_point_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (map_point_id) REFERENCES map_points(id) ON DELETE CASCADE
);

------------------------------ POSTS ------------------------------

/*
  Posts table
*/
CREATE TABLE IF NOT EXISTS posts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(2048) NOT NULL,
    posted_by INT NULL,
    map_point_id INT NOT NULL,
    FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (map_point_id) REFERENCES map_points(id) ON DELETE CASCADE,

    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


/*
 Track attempts to save a post as early as possible in the flow, before
 user auth and location resolution, to measure success rates and errors.
*/
CREATE TABLE IF NOT EXISTS post_save_attempts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id CHAR(36) NULL,
    url VARCHAR(2048) NULL,
    session_token CHAR(36) NULL,
    user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

----------------------------- FRIENDS -----------------------------

/*
  Friends table (allows many to many relationship between users)
*/
CREATE TABLE IF NOT EXISTS friends (
    user_id_1 INT NOT NULL,
    user_id_2 INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id_1, user_id_2),
    FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE
);


/*
  Location invitations table (allows user to invite another user to a location)
*/
CREATE TABLE IF NOT EXISTS location_invitations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  creator_id INT NOT NULL,
  recipient_id INT NOT NULL,
  map_point_id INT NOT NULL,
  message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (map_point_id) REFERENCES map_points(id) ON DELETE CASCADE
);


----------------------------- FOLDERS -----------------------------

/*
  Standalone folders
*/
CREATE TABLE IF NOT EXISTS folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(16) NOT NULL, -- Assuming we can just serialize the color to a string
    creator_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

/*
  Folder owners (allows many to many relationship between folders and users with edit permissions)
*/
CREATE TABLE IF NOT EXISTS folder_owners (
    folder_id INT NOT NULL,
    user_id INT NOT NULL,

    PRIMARY KEY (folder_id, user_id),
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

/*
  Location folder attributions (allows many to many relationship between locations and folders)
*/
CREATE TABLE IF NOT EXISTS folder_locations (
    folder_id INT NOT NULL,
    map_point_id INT NOT NULL,

    PRIMARY KEY (folder_id, map_point_id),
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (map_point_id) REFERENCES map_points(id) ON DELETE CASCADE
);

/*
  Folder follows (allows user to follow a folder)
*/
CREATE TABLE IF NOT EXISTS folder_follows (
    user_id INT NOT NULL,
    folder_id INT NOT NULL,

    PRIMARY KEY (user_id, folder_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);


