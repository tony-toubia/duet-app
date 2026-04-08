const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to fix RCTThirdPartyComponentsProvider.mm crash on iOS 26.
 *
 * React Native's codegen generates RCTThirdPartyComponentsProvider.mm using an
 * @{...} NSDictionary literal with NSClassFromString() values. When the New
 * Architecture (Fabric) is disabled, NSClassFromString() returns nil for Fabric
 * component view classes, and inserting nil into an NSDictionary literal crashes:
 *   *** -[__NSPlaceholderDictionary initWithObjects:forKeys:count:]:
 *       attempt to insert nil object from objects[0]
 *
 * This plugin applies two layers of defence:
 *   1. Patches the codegen template & generator in node_modules so the codegen
 *      emits nil-safe NSMutableDictionary code instead of @{} literals.
 *   2. Adds a Podfile post_install hook that fixes the generated file in-place
 *      after codegen runs, as a safety net.
 */
function withThirdPartyComponentsFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;

      // ── Layer 1: Patch codegen inputs in node_modules ──
      patchTemplate(projectRoot);
      patchGenerator(projectRoot);

      // ── Layer 2: Podfile post_install safety net ──
      patchPodfile(platformRoot);

      return config;
    },
  ]);
}

/**
 * Patch the .mm template so codegen produces nil-safe dictionary construction.
 */
function patchTemplate(projectRoot) {
  const templatePath = path.join(
    projectRoot,
    'node_modules/react-native/scripts/codegen/templates/RCTThirdPartyComponentsProviderMM.template',
  );

  if (!fs.existsSync(templatePath)) {
    console.warn('[withThirdPartyComponentsFix] Template not found at', templatePath);
    return;
  }

  let content = fs.readFileSync(templatePath, 'utf8');

  if (!content.includes('thirdPartyComponents = @{')) {
    console.log('[withThirdPartyComponentsFix] Template already patched (or format changed)');
    return;
  }

  content = content
    .replace(
      '    thirdPartyComponents = @{',
      '    NSMutableDictionary<NSString *, Class<RCTComponentViewProtocol>> *components = [NSMutableDictionary new];',
    )
    .replace(
      '    };',
      '    thirdPartyComponents = [components copy];',
    );

  fs.writeFileSync(templatePath, content);
  console.log('[withThirdPartyComponentsFix] Patched template');
}

/**
 * Patch the generator so each component entry is nil-safe.
 */
function patchGenerator(projectRoot) {
  const generatorPath = path.join(
    projectRoot,
    'node_modules/react-native/scripts/codegen/generate-artifacts-executor/generateRCTThirdPartyComponents.js',
  );

  if (!fs.existsSync(generatorPath)) {
    console.warn('[withThirdPartyComponentsFix] Generator not found at', generatorPath);
    return;
  }

  let content = fs.readFileSync(generatorPath, 'utf8');

  // Match the original dictionary-literal format string
  const needle = '@"${componentName}": NSClassFromString(@"${className}"),';
  if (!content.includes(needle)) {
    console.log('[withThirdPartyComponentsFix] Generator already patched (or format changed)');
    return;
  }

  // Replace the return statement that builds each component entry
  content = content.replace(
    /return `\t\t@"\$\{componentName\}": NSClassFromString\(@"\$\{className\}"\),\s*\/\/\s*\$\{library\}`;/,
    'return `\\t\\t{ Class cls = NSClassFromString(@"${className}"); if (cls) components[@"${componentName}"] = cls; } // ${library}`;',
  );

  fs.writeFileSync(generatorPath, content);
  console.log('[withThirdPartyComponentsFix] Patched generator');
}

/**
 * Add a Podfile post_install hook that fixes the generated file after codegen.
 * This is the ultimate safety net: even if the template/generator patches don't
 * take effect (cache, different codegen path, etc.), this rewrites the output.
 */
function patchPodfile(platformRoot) {
  const podfilePath = path.join(platformRoot, 'Podfile');

  if (!fs.existsSync(podfilePath)) {
    console.warn('[withThirdPartyComponentsFix] Podfile not found');
    return;
  }

  let podfile = fs.readFileSync(podfilePath, 'utf8');

  if (podfile.includes('withThirdPartyComponentsFix')) {
    console.log('[withThirdPartyComponentsFix] Podfile already patched');
    return;
  }

  const rubySnippet = [
    '',
    '    # [withThirdPartyComponentsFix] Fix nil crash in RCTThirdPartyComponentsProvider.mm',
    '    thirdparty_fix_path = File.join(__dir__, "build", "generated", "ios", "RCTThirdPartyComponentsProvider.mm")',
    '    if File.exist?(thirdparty_fix_path)',
    '      thirdparty_src = File.read(thirdparty_fix_path)',
    '      if thirdparty_src.include?("thirdPartyComponents = @{")',
    '        Pod::UI.puts "[withThirdPartyComponentsFix] Fixing generated RCTThirdPartyComponentsProvider.mm"',
    '        thirdparty_src.sub!("thirdPartyComponents = @{", "NSMutableDictionary<NSString *, Class<RCTComponentViewProtocol>> *components = [NSMutableDictionary new];")',
    '        thirdparty_src.sub!(/^\\s*\\};\\s*$/, "    thirdPartyComponents = [components copy];")',
    '        thirdparty_src.gsub!(/\\s*@"(\\w+)":\\s*NSClassFromString\\(@"(\\w+)"\\),?\\s*\\/\\/\\s*(.*)/) do',
    '          "\\t\\t{ Class cls = NSClassFromString(@\\"#{$2}\\"); if (cls) components[@\\"#{$1}\\"] = cls; } // #{$3}"',
    '        end',
    '        File.write(thirdparty_fix_path, thirdparty_src)',
    '      end',
    '    end',
  ].join('\n');

  // Insert before the last `end` in the file (closes the post_install block).
  // This is more robust than trying to match react_native_post_install(...)
  // which may have nested parentheses that break regex matching.
  const lines = podfile.split('\n');
  let inserted = false;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === 'end') {
      lines.splice(i, 0, rubySnippet);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    console.warn('[withThirdPartyComponentsFix] Could not find closing end in Podfile');
    return;
  }

  podfile = lines.join('\n');
  fs.writeFileSync(podfilePath, podfile);
  console.log('[withThirdPartyComponentsFix] Added Podfile post_install safety net');
}

module.exports = withThirdPartyComponentsFix;
