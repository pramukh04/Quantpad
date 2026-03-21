import fs from 'fs';
import path from 'path';

const walkSync = function (dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function (file) {
    if (fs.statSync(dir + '/' + file).isDirectory()) {
      filelist = walkSync(dir + '/' + file, filelist);
    }
    else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        filelist.push(dir + '/' + file);
      }
    }
  });
  return filelist;
};

const allFiles = walkSync('src', []);
let replacedCount = 0;

allFiles.forEach(file => {
  const fullPath = path.resolve(file);
  let content = fs.readFileSync(fullPath, 'utf8');

  let original = content;

  // Safe replacements
  content = content.replace(/\('\-\$'\)/g, "('-₹')");
  content = content.replace(/\('\+\$'\)/g, "('+₹')");
  content = content.replace(/'\-\$'/g, "'-₹'");
  content = content.replace(/'\+\$'/g, "'+₹'");
  content = content.replace(/`-\$`/g, "`'-₹'`"); // Unlikely
  content = content.replace(/ \$/g, " ₹"); // e.g. "Total PnL: $"
  content = content.replace(/>\$/g, ">₹"); // JSX: >$<span>
  content = content.replace(/`\$\$\{/g, "`₹\${"); // Template strings: `$${var}`
  content = content.replace(/:\s*\$/g, ": ₹"); // ": $"
  content = content.replace(/"\$\"/g, "\"₹\""); // "$"
  content = content.replace(/'\$'/g, "'₹'"); // '$'
  content = content.replace(/in\ \$/g, "in ₹"); // "in $"

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    replacedCount++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Finished modifying ${replacedCount} files.`);
