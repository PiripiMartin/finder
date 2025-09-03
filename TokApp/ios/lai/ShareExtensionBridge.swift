import Foundation
import React

@objc(ShareExtensionBridge)
class ShareExtensionBridge: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func getSharedData(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    // Access the shared UserDefaults
    if let userDefaults = UserDefaults(suiteName: "group.com.piripimartin.dew") {
      
      if let sharedData = userDefaults.object(forKey: "SharedData") as? [String: Any] {
        // Clear the data after reading
        userDefaults.removeObject(forKey: "SharedData")
        userDefaults.removeObject(forKey: "SharedDataTimestamp")
        userDefaults.synchronize()
        
        resolve(sharedData)
      } else {
        resolve(NSNull())
      }
    } else {
      reject("ERROR", "Could not access shared UserDefaults", nil)
    }
  }
}
