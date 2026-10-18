const fs = require('fs');
const html = fs.readFileSync('C:/Users/29189/Desktop/tod/index.html', 'utf-8');

// Find todo's prompt template literal
const todoId = html.indexOf("id: 'todo'");
const promptField = html.indexOf('prompt: `', todoId);
const promptOpen = promptField + 8;
let closeIdx = promptOpen + 1;
while (closeIdx < html.length) {
  if (html[closeIdx] === '\\' && html[closeIdx + 1] === '`') { closeIdx += 2; continue; }
  if (html[closeIdx] === '`') break;
  closeIdx++;
}
let prompt = html.substring(promptOpen + 1, closeIdx);

// Normalize line endings
prompt = prompt.replace(/\r\n/g, '\n');

fs.writeFileSync('C:/Users/29189/Desktop/1234/todo-prompt-v2.0.txt', prompt, 'utf-8');
console.log('OK: written', prompt.length, 'chars,', prompt.split('\n').length, 'lines');
