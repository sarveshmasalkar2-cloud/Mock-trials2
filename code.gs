function doGet(e) {
  var page = e.parameter.page;
  
  if (page == 'mobile') {
    try {
      return HtmlService.createTemplateFromFile('mobilesupport')
        .evaluate()
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
        .setTitle('Quantum Legal Lab - Mobile')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      // Fallback if mobilesupport file is missing in GAS project
      return HtmlService.createHtmlOutput("Error: mobilesupport.html not found in script project. Please create it.")
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }
  }
  
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('Quantum Legal Lab')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

