----------------------------- USERS -----------------------------

/*
  Users table
*/
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(32) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(128) NOT NULL,
    
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

/* 
  Tracks manual edits (and the resulting Google Maps location resolution) for a given location made by a given user.
*/
CREATE TABLE IF NOT EXISTS user_location_edits (
    user_id INT NOT NULL,
    map_point_id INT NOT NULL,

    google_place_id VARCHAR(255) UNIQUE NULL, 
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
  Tracks locations a specific user has chosen to delete (soft-delete per user).
  Used to hide these locations from that user's saved/recommended lists and detail fetches.
*/
CREATE TABLE IF NOT EXISTS user_deleted_locations (
    user_id INT NOT NULL,
    map_point_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, map_point_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (map_point_id) REFERENCES map_points(id) ON DELETE CASCADE
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

----------------------------- FOLDERS -----------------------------

/*
  Standalone folders
*/
CREATE TABLE IF NOT EXISTS folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    creator_id INT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(16) NOT NULL, -- Assuming we can just serialize the color to a string
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
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


