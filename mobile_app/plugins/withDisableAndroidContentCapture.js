const { withMainActivity } = require("@expo/config-plugins");

const IMPORT_VIEW = "import android.view.View";
const IMPORT_BUILD = "import android.os.Build";
const CONTENT_CAPTURE_BLOCK = `
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.decorView.importantForContentCapture =
        View.IMPORTANT_FOR_CONTENT_CAPTURE_NO_EXCLUDE_DESCENDANTS
    }
`;

function withDisableAndroidContentCapture(config) {
  return withMainActivity(config, (mod) => {
    if (mod.modResults.language !== "kt") {
      return mod;
    }

    let contents = mod.modResults.contents;
    if (!contents.includes(IMPORT_VIEW)) {
      contents = contents.replace("import android.os.Bundle", `import android.os.Bundle\n${IMPORT_VIEW}`);
    }
    // CONTENT_CAPTURE_BLOCK references Build.VERSION; the RN template imports
    // Bundle but not Build, so a clean prebuild fails with "unresolved
    // reference: Build" without this. Guarded so a template that already
    // imports Build isn't double-injected.
    if (!contents.includes(IMPORT_BUILD)) {
      contents = contents.replace("import android.os.Bundle", `import android.os.Bundle\n${IMPORT_BUILD}`);
    }

    if (!contents.includes("IMPORTANT_FOR_CONTENT_CAPTURE_NO_EXCLUDE_DESCENDANTS")) {
      contents = contents.replace("    super.onCreate(null)", `    super.onCreate(null)\n${CONTENT_CAPTURE_BLOCK}`);
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = withDisableAndroidContentCapture;
