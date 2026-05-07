const { withMainActivity } = require("@expo/config-plugins");

const IMPORT_VIEW = "import android.view.View";
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

    if (!contents.includes("IMPORTANT_FOR_CONTENT_CAPTURE_NO_EXCLUDE_DESCENDANTS")) {
      contents = contents.replace("    super.onCreate(null)", `    super.onCreate(null)\n${CONTENT_CAPTURE_BLOCK}`);
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = withDisableAndroidContentCapture;
