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

  // Revert broken template literal interpolation
  content = content.replace(/₹\{/g, '${');

  // Custom manual fixes
  content = content.replace(/'\$24\.50'/g, "'₹24.50'");

  // Fix missed ones in Dashboard
  content = content.replace(/>\$/g, '>₹');
  content = content.replace(/\('\$'\)/g, "('₹')");

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    replacedCount++;
    console.log(`Repaired ${file}`);
  }
});

console.log(`Finished repairing ${replacedCount} files.`);
