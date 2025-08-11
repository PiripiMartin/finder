
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(32) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(128) NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


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


CREATE TABLE IF NOT EXISTS map_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    emoji VARCHAR(16) NOT NULL,
    location POINT NOT NULL,
    recommendable BOOLEAN NOT NULL DEFAULT FALSE,
    SPATIAL INDEX idx_location (location),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS posts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(2048) NOT NULL,
    posted_by INT,
    map_point_id INT NOT NULL,
    FOREIGN KEY (posted_by) REFERENCES users(id),
    FOREIGN KEY (map_point_id) REFERENCES map_points(id) ON DELETE CASCADE,

    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);




