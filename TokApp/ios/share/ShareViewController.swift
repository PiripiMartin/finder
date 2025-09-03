import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers
import os.log

class ShareViewController: UIViewController {
    private let logger = Logger(subsystem: "com.piripimartin.dew.ShareExtension", category: "ShareViewController")
    
    // UI Elements
    private let containerView = UIView()
    private let statusLabel = UILabel()
    private let activityIndicator = UIActivityIndicatorView(style: .large)
    private let progressView = UIProgressView(progressViewStyle: .default)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        logger.info("🚀 ShareViewController loaded")
        setupUI()
        processSharedContent()
    }
    
    private func setupUI() {
        // Set up the main view
        view.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        
        // Container view (white card)
        containerView.backgroundColor = .white
        containerView.layer.cornerRadius = 16
        containerView.layer.shadowColor = UIColor.black.cgColor
        containerView.layer.shadowOffset = CGSize(width: 0, height: 4)
        containerView.layer.shadowOpacity = 0.3
        containerView.layer.shadowRadius = 8
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)
        
        // Status label
        statusLabel.text = "Saving..."
        statusLabel.font = UIFont.systemFont(ofSize: 18, weight: .medium)
        statusLabel.textColor = .darkGray
        statusLabel.textAlignment = .center
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(statusLabel)
        
        // Activity indicator
        activityIndicator.color = .systemBlue
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(activityIndicator)
        
        // Progress view (initially hidden)
        progressView.progressTintColor = .systemBlue
        progressView.trackTintColor = .lightGray
        progressView.alpha = 0
        progressView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(progressView)
        
        // Constraints
        NSLayoutConstraint.activate([
            // Container view - centered and sized
            containerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            containerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            containerView.widthAnchor.constraint(equalToConstant: 280),
            containerView.heightAnchor.constraint(equalToConstant: 120),
            
            // Status label
            statusLabel.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            statusLabel.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 20),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
            
            // Activity indicator
            activityIndicator.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            activityIndicator.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 20),
            
            // Progress view
            progressView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            progressView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
            progressView.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 30),
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
            showError(message: "Please log in to the app first")
            return
        }
    }

    private func saveVideoToAPI(data: [String: Any], sessionToken: String) {
        logger.info("🌐 Making POST request to save-video endpoint")
        
        guard let url = URL(string: "https://ptvalert.xyz/api/save-video") else {
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
        statusLabel.text = "Saved!"
        activityIndicator.stopAnimating()
        activityIndicator.alpha = 0
        
        // Show and animate progress bar
        progressView.alpha = 1
        progressView.progress = 0
        
        // Update status after short delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.statusLabel.text = "Closing..."
            
            // Animate progress bar
            UIView.animate(withDuration: 1.0, animations: {
                self.progressView.progress = 1.0
            }) { _ in
                // Close after animation completes
                self.completeRequest()
            }
        }
    }
    
    private func showError(message: String) {
        logger.error("❌ Showing error: \(message)")
        
        // Update UI to show error
        statusLabel.text = "Error: \(message)"
        statusLabel.textColor = .systemRed
        activityIndicator.stopAnimating()
        activityIndicator.alpha = 0
        
        // Show progress bar and auto-close after 2 seconds
        progressView.alpha = 1
        progressView.progress = 0
        progressView.progressTintColor = .systemRed
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.statusLabel.text = "Closing..."
            
            UIView.animate(withDuration: 1.0, animations: {
                self.progressView.progress = 1.0
            }) { _ in
                self.completeRequest()
            }
        }
    }

    private func completeRequest() {
        logger.info("🏁 Share extension request completed")
        self.extensionContext?.completeRequest(returningItems: [], completionHandler: { [weak self] success in
            self?.logger.info("🎯 Extension completion callback - success: \(success)")
        })
    }
}