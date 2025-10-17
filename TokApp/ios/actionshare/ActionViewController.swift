import UIKit
import MobileCoreServices
import UniformTypeIdentifiers
import os.log

class ActionViewController: UIViewController {
    private let logger = Logger(subsystem: "com.piripimartin.dew.ActionExtension", category: "ActionViewController")
    
    // UI Elements
    private let containerView = UIView()
    private let statusLabel = UILabel()
    private let brandLabel = UILabel() // "lai" branding
    private let activityIndicator = UIActivityIndicatorView(style: .large)
    private let closingIndicator = UIActivityIndicatorView(style: .medium)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        logger.info("🚀 ActionViewController loaded")
        setupUI()
        processSharedContent()
    }
    
    private func setupUI() {
        // Set up the main view - clear background (no overlay)
        view.backgroundColor = .clear
        
        // Container view (app theme color bottom sheet)
      containerView.backgroundColor = .white // #FFF0F0
        containerView.layer.cornerRadius = 20
        containerView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner] // Only top corners
        containerView.layer.shadowColor = UIColor.black.cgColor
        containerView.layer.shadowOffset = CGSize(width: 0, height: -2)
        containerView.layer.shadowOpacity = 0.1
        containerView.layer.shadowRadius = 10
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)
        
        // Status label
        statusLabel.text = "Saving..."
        statusLabel.font = UIFont.systemFont(ofSize: 20, weight: .medium)
        statusLabel.textColor = .darkGray
        statusLabel.textAlignment = .center
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(statusLabel)
        
        // Brand label ("lai")
        brandLabel.text = "lai"
        brandLabel.font = UIFont.systemFont(ofSize: 40, weight: .bold) // Bigger letters
        brandLabel.textColor = UIColor(red: 0.4, green: 0.3, blue: 0.2, alpha: 1.0) // Brown text color
        brandLabel.textAlignment = .center
        brandLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(brandLabel)
        
        // Activity indicator
        activityIndicator.color = .systemBlue
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(activityIndicator)
        
        // Closing indicator (initially hidden)
        closingIndicator.color = .darkGray
        closingIndicator.alpha = 0
        closingIndicator.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(closingIndicator)
        
        // Constraints for bottom sheet layout
        NSLayoutConstraint.activate([
            // Container view - bottom half of screen
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            containerView.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: 0.5),
            
            // Status label - positioned in upper part of bottom sheet
            statusLabel.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            statusLabel.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 60),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 40),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -40),
            
            // Activity indicator - positioned below status label
            activityIndicator.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            activityIndicator.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 30),
            
            // Closing indicator - positioned below status label (same position as activity indicator)
            closingIndicator.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            closingIndicator.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 30),
            
            // Brand label - positioned below activity indicator
            brandLabel.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            brandLabel.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 25),
        ])
        
        // Start the activity indicator
        activityIndicator.startAnimating()
    }
    
    private func processSharedContent() {
        logger.info("🔄 Processing shared content")
        
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else {
            logger.warning("❌ No attachments found in extension item")
            showError(message: "No content to share")
            return
        }
        
        logger.info("📎 Found \(attachments.count) attachments")
        
        let group = DispatchGroup()
        var sharedData: [String: Any] = [:]
        
        for (index, attachment) in attachments.enumerated() {
            logger.info("🔍 Processing attachment \(index + 1)/\(attachments.count)")
            group.enter()
            
            if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                logger.info("🔗 Attachment \(index + 1) is a URL")
                attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { (item, error) in
                    if let error = error {
                        self.logger.error("❌ Error loading URL: \(error.localizedDescription)")
                    } else if let url = item as? URL {
                        self.logger.info("✅ Successfully loaded URL: \(url.absoluteString)")
                        sharedData["url"] = url.absoluteString
                        sharedData["type"] = "url"
                        
                        // Check if it's a TikTok URL
                        if url.absoluteString.contains("tiktok.com") || url.absoluteString.contains("vm.tiktok.com") || url.absoluteString.contains("vt.tiktok.com") {
                            self.logger.info("🎵 Detected TikTok URL!")
                            sharedData["isTikTokUrl"] = true
                        }
                    } else {
                        self.logger.warning("⚠️ URL item was not a URL type")
                    }
                    group.leave()
                }
            } else if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                logger.info("📝 Attachment \(index + 1) is plain text")
                attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { (item, error) in
                    if let error = error {
                        self.logger.error("❌ Error loading text: \(error.localizedDescription)")
                    } else if let text = item as? String {
                        self.logger.info("✅ Successfully loaded text: \(text.prefix(100))...")
                        sharedData["text"] = text
                        sharedData["type"] = "text"
                        
                        // Check if text contains a URL
                        if let url = self.extractURL(from: text) {
                            self.logger.info("🔗 Found URL in text: \(url)")
                            sharedData["url"] = url
                            sharedData["type"] = "url"
                            
                            if url.contains("tiktok.com") || url.contains("vm.tiktok.com") || url.contains("vt.tiktok.com") {
                                self.logger.info("🎵 Detected TikTok URL in text!")
                                sharedData["isTikTokUrl"] = true
                            }
                        }
                    } else {
                        self.logger.warning("⚠️ Text item was not a String type")
                    }
                    group.leave()
                }
            } else {
                logger.info("❓ Attachment \(index + 1) is of unknown type")
                group.leave()
            }
        }
        
        group.notify(queue: .main) {
            self.logger.info("✅ All attachments processed, sending data to backend API")
            self.sendDataToMainApp(data: sharedData)
        }
    }
    
    private func extractURL(from text: String) -> String? {
        logger.debug("🔍 Extracting URL from text")
        let urlRegex = try! NSRegularExpression(pattern: "(https?://[^\\s]+)", options: [])
        let range = NSRange(location: 0, length: text.utf16.count)
        
        if let match = urlRegex.firstMatch(in: text, options: [], range: range) {
            let urlRange = Range(match.range, in: text)!
            let extractedURL = String(text[urlRange])
            logger.info("✅ Extracted URL: \(extractedURL)")
            return extractedURL
        }
        
        logger.debug("❌ No URL found in text")
        return nil
    }
    
    private func sendDataToMainApp(data: [String: Any]) {
        logger.info("📤 Sending data to backend API")
        logger.info("📊 Data to send: \(data)")
        
        // Debug: Check if we can access UserDefaults at all
        logger.info("🔍 Attempting to access shared UserDefaults with suite name: group.com.piripimartin.dew")
        
        guard let userDefaults = UserDefaults(suiteName: "group.com.piripimartin.dew") else {
            logger.error("❌ Could not create UserDefaults with suite name")
            showError(message: "Configuration error")
            return
        }
        
        logger.info("✅ Successfully created UserDefaults with suite name")
        
        // Debug: List all keys in shared UserDefaults
        let allKeys = userDefaults.dictionaryRepresentation().keys
        logger.info("🔑 All keys in shared UserDefaults: \(Array(allKeys))")
        
        // Try to get session token
        let sessionToken = userDefaults.string(forKey: "sessionToken")
        logger.info("🔍 Session token from UserDefaults: \(sessionToken != nil ? "FOUND" : "NOT FOUND")")
        
        if let token = sessionToken {
            logger.info("📱 Token length: \(token.count) characters")
            logger.info("✅ Found session token, making API call")
            saveVideoToAPI(data: data, sessionToken: token)
        } else {
            logger.error("❌ No session token found - user must be logged in to share content")
            showError(message: "You must log in to the app first to share content")
            return
        }
    }

    private func saveVideoToAPI(data: [String: Any], sessionToken: String) {
        logger.info("🌐 Making POST request to post endpoint")
        
        guard let url = URL(string: "https://ptvalert.xyz/api/post") else {
            logger.error("❌ Invalid API URL")
            showError(message: "Configuration error")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        
        // Prepare request body
        var requestBody: [String: Any] = [:]
        if let videoUrl = data["url"] as? String {
            requestBody["url"] = videoUrl
        }
        if let text = data["text"] as? String {
            requestBody["text"] = text
        }
        if let isTikTokUrl = data["isTikTokUrl"] as? Bool {
            requestBody["isTikTokUrl"] = isTikTokUrl
        }
        requestBody["type"] = data["type"]
        requestBody["sharedAt"] = ISO8601DateFormatter().string(from: Date())
        
        logger.info("📦 Request body: \(requestBody)")
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        } catch {
            logger.error("❌ Failed to serialize request body: \(error)")
            showError(message: "Failed to prepare request")
            return
        }
        
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.handleAPIResponse(data: data, response: response, error: error)
            }
        }
        
        logger.info("🚀 Starting API request")
        task.resume()
    }

    private func handleAPIResponse(data: Data?, response: URLResponse?, error: Error?) {
        if let error = error {
            logger.error("❌ API request failed: \(error.localizedDescription)")
            showError(message: "Network error")
            return
        }
        
        guard let httpResponse = response as? HTTPURLResponse else {
            logger.error("❌ Invalid response type")
            showError(message: "Invalid server response")
            return
        }
        
        logger.info("📡 API response status: \(httpResponse.statusCode)")
        
        if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
            logger.info("✅ Video saved successfully to backend")
            showSuccess()
        } else if httpResponse.statusCode == 422 {
            logger.info("⚠️ Video saved but location not found (422)")
            showSuccessWithWarning(message: "We couldn't find the location from TikTok video, but we still saved it for you")
        } else {
            logger.error("❌ API request failed with status: \(httpResponse.statusCode)")
            var errorMessage = "Server error"
            
            if let data = data,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = json["message"] as? String {
                errorMessage = message
            }
            
            showError(message: errorMessage)
        }
    }

    private func showSuccess() {
        logger.info("✅ Showing success state")
        
        // Update UI to show success
        statusLabel.text = "Saved! Find in your saved tab"
        activityIndicator.stopAnimating()
        activityIndicator.alpha = 0
        
        // Show the success message for 1 second
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            // Then show closing state
            self.statusLabel.text = "Closing..."
            
            // Show circular closing indicator
            self.closingIndicator.alpha = 1
            self.closingIndicator.startAnimating()
            
            // Close after 0.5 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.completeRequest()
            }
        }
    }
    
    private func showSuccessWithWarning(message: String) {
        logger.info("⚠️ Showing success with warning: \(message)")
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.activityIndicator.stopAnimating() // Stop main spinner
            self.statusLabel.text = "Saved!"
            self.statusLabel.textColor = .systemOrange // Orange color for warning
            
            // Create and show warning message label
            let warningLabel = UILabel()
            warningLabel.text = message
            warningLabel.font = UIFont.systemFont(ofSize: 12)
            warningLabel.textColor = .systemOrange
            warningLabel.textAlignment = .center
            warningLabel.numberOfLines = 0
            warningLabel.translatesAutoresizingMaskIntoConstraints = false
            self.containerView.addSubview(warningLabel)
            
            // Position warning label below status label
            NSLayoutConstraint.activate([
                warningLabel.centerXAnchor.constraint(equalTo: self.containerView.centerXAnchor),
                warningLabel.topAnchor.constraint(equalTo: self.statusLabel.bottomAnchor, constant: 10),
                warningLabel.leadingAnchor.constraint(equalTo: self.containerView.leadingAnchor, constant: 20),
                warningLabel.trailingAnchor.constraint(equalTo: self.containerView.trailingAnchor, constant: -20),
            ])
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { // Display warning for 2 seconds
                self.statusLabel.text = "Closing..."
                self.statusLabel.textColor = .darkGray
                warningLabel.isHidden = true // Hide warning message
                self.closingIndicator.alpha = 1
                self.closingIndicator.startAnimating()
                
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    self.completeRequest()
                }
            }
        }
    }
    
    private func showError(message: String) {
        logger.error("❌ Showing error: \(message)")
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.activityIndicator.stopAnimating() // Stop main spinner
            
            // Check if this is a login error vs other errors
            if message.contains("log in") {
                // Show login-specific message
                self.statusLabel.text = message // Show the actual login message
                self.statusLabel.textColor = .systemRed
                self.statusLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium) // Smaller for longer text
                
                // No contact info for login errors - user just needs to log in
            } else {
                // Show generic error for API/server errors
                self.statusLabel.text = "Saving post failed"
                self.statusLabel.textColor = .systemRed
                self.statusLabel.font = UIFont.systemFont(ofSize: 18, weight: .medium)
                
                // Add contact info label for server errors
                let contactLabel = UILabel()
                contactLabel.text = "Contact lai.contact.help@gmail.com if this keeps happening"
                contactLabel.font = UIFont.systemFont(ofSize: 12, weight: .regular)
                contactLabel.textColor = .systemRed
                contactLabel.textAlignment = .center
                contactLabel.numberOfLines = 0
                contactLabel.translatesAutoresizingMaskIntoConstraints = false
                self.containerView.addSubview(contactLabel)
                
                // Position contact label below main status
                NSLayoutConstraint.activate([
                    contactLabel.leadingAnchor.constraint(equalTo: self.containerView.leadingAnchor, constant: 20),
                    contactLabel.trailingAnchor.constraint(equalTo: self.containerView.trailingAnchor, constant: -20),
                    contactLabel.topAnchor.constraint(equalTo: self.statusLabel.bottomAnchor, constant: 10),
                ])
            }
            
            // Show the error message for 2 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                // Then show closing state
                self.statusLabel.text = "Closing..."
                self.statusLabel.textColor = .darkGray // Reset color for closing message
                self.statusLabel.font = UIFont.systemFont(ofSize: 20, weight: .medium) // Reset font size
                
                // Show circular closing indicator
                self.closingIndicator.alpha = 1
                self.closingIndicator.startAnimating()
                
                // Close after 0.5 seconds
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.completeRequest()
                }
            }
        }
    }

    private func completeRequest() {
        logger.info("🏁 Action extension request completed")
        self.extensionContext?.completeRequest(returningItems: [], completionHandler: { [weak self] success in
            self?.logger.info("🎯 Extension completion callback - success: \(success)")
        })
    }
}

