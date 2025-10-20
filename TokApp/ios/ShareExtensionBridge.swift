import Foundation

@objc(SharedUserDefaults)
class SharedUserDefaults: NSObject {
  
  let suiteName = "group.com.piripimartin.dew"
  
  @objc
  func setSessionToken(_ token: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: suiteName) else {
      reject("ERROR", "Could not create UserDefaults with suite name", nil)
      return
    }
    
    userDefaults.set(token, forKey: "sessionToken")
    userDefaults.synchronize()
    
    NSLog("✅ [SharedUserDefaults] Session token stored successfully")
    resolve(true)
    
    
  }
  
  @objc
  func getSessionToken(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: suiteName) else {
      reject("ERROR", "Could not create UserDefaults with suite name", nil)
      return
    }
    
    let token = userDefaults.string(forKey: "sessionToken")
    NSLog("📖 [SharedUserDefaults] Reading session token: \(token != nil ? "FOUND" : "NOT FOUND")")
    resolve(token)
  }
  
  @objc
  func removeSessionToken(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: suiteName) else {
      reject("ERROR", "Could not create UserDefaults with suite name", nil)
      return
    }
    
    userDefaults.removeObject(forKey: "sessionToken")
    userDefaults.synchronize()
    
    NSLog("🗑️ [SharedUserDefaults] Session token removed")
    resolve(true)
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}

