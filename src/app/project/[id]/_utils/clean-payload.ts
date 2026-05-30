export function cleanPayload(obj: any): any {
  if (obj === undefined) return undefined;
  if (obj === null) return null;
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanPayload(item)).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    // Preserve Date and Firestore FieldValue/Timestamp objects
    if (obj instanceof Date || (obj.constructor && obj.constructor.name === 'Timestamp') || (obj.constructor && obj.constructor.name === 'FieldValue')) {
      return obj;
    }
    
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanPayload(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }
  
  return obj;
}
