import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: SLComposeServiceViewController {
    
    override func isContentValid() -> Bool {
        // Always return true to allow sharing
        return true
    }

    override func didSelectPost() {
        // Get the shared content
        if let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem {
            processSharedContent(extensionItem: extensionItem)
        } else {
            completeRequest()
        }
    }
    
    private func processSharedContent(extensionItem: NSExtensionItem) {
        guard let attachments = extensionItem.attachments else {
            completeRequest()
            return
        }
        
        let group = DispatchGroup()
        var sharedData: [String: Any] = [:]
        
        // Process each attachment
        for attachment in attachments {
            group.enter()
            
            // Handle URLs
            if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { (item, error) in
                    if let url = item as? URL {
                        sharedData["url"] = url.absoluteString
                        sharedData["type"] = "url"
                    }
                    group.leave()
                }
            }
            // Handle plain text
            else if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { (item, error) in
                    if let text = item as? String {
                        sharedData["text"] = text
                        sharedData["type"] = "text"
                        
                        // Check if text contains a URL
                        if let url = self.extractURL(from: text) {
                            sharedData["url"] = url
                            sharedData["type"] = "url"
                        }
                    }
                    group.leave()
                }
            }
            else {
                group.leave()
            }
        }
        
        // Wait for all attachments to be processed
        group.notify(queue: .main) {
            self.sendDataToMainApp(data: sharedData)
        }
    }
    
    private func extractURL(from text: String) -> String? {
        let urlRegex = try! NSRegularExpression(pattern: "(https?://[^\\s]+)", options: [])
        let range = NSRange(location: 0, length: text.utf16.count)
        
        if let match = urlRegex.firstMatch(in: text, options: [], range: range) {
            let urlRange = Range(match.range, in: text)!
            return String(text[urlRange])
        }
        return nil
    }
    
    private func sendDataToMainApp(data: [String: Any]) {
        // Save data to UserDefaults that the main app can access
        if let userDefaults = UserDefaults(suiteName: "group.com.piripimartin.dew") {
            userDefaults.set(data, forKey: "SharedData")
            userDefaults.set(Date(), forKey: "SharedDataTimestamp")
            userDefaults.synchronize()
        }
        
        // Open the main app with a custom URL scheme
        let urlString = "lai://share"
        if let url = URL(string: urlString) {
            var responder: UIResponder? = self
            while responder != nil {
                if let application = responder as? UIApplication {
                    application.perform(#selector(UIApplication.openURL(_:)), with: url)
                    break
                }
                responder = responder?.next
            }
        }
        
        completeRequest()
    }
    
    private func completeRequest() {
        self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    override func configurationItems() -> [Any]! {
        // No configuration items needed
        return []
    }
}
