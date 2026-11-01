# Contact API implementation notes

Use the installed Expo SDK 57 contact API, not the latest SDK 58 documentation. Expo 57 exposes `Contact.presentPicker()` and `Contact.getAllDetails()` with `ContactField.FULL_NAME` / `PHONES`. Old `getContactsAsync()` and `presentContactPickerAsync()` exports are deprecated and throw unless imported from the legacy namespace. Native library import must be an explicit action with contact permission; the selected native picker is a separate lower-scope action. Read the installed types for exact return keys.

The browser Contact Picker is limited-availability and requires a secure top-level context and user interaction. `navigator.contacts.select(['name','tel'], {multiple:true})` must be invoked from the click flow, without an unrelated permission request or awaited capability call before it. Embedded Preview may not qualify; manual/paste remain available. Never treat browser API support as native Expo support.

Sources checked:
- https://docs.expo.dev/versions/v57.0.0/sdk/contacts/
- https://developer.mozilla.org/en-US/docs/Web/API/Contact_Picker_API

No phone/device contact access has been exercised in this session. No address-book data is uploaded during import; selected numbers are sent only after the final batch review and confirmation.
