#!/usr/bin/env node
const fs = require("fs");
const { hide, reveal } = require("./steg");

const USAGE = `Хэрэглээ:
  node cli.js hide   -s "нууц" -c "далд текст" [-p нууц-үг] [-o out.txt]
  node cli.js reveal (-t "текст" | -f file.txt)  [-p нууц-үг]`;

function parseArgs(argv) {
  const opts = {};
  const names = { "-s": "secret", "-c": "cover", "-p": "password", "-o": "out", "-t": "text", "-f": "file" };
  for (let i = 0; i < argv.length; i += 2) {
    const name = names[argv[i]];
    if (!name || argv[i + 1] === undefined) throw new Error(`Буруу аргумент: ${argv[i]}`);
    opts[name] = argv[i + 1];
  }
  return opts;
}

try {
  const [command, ...rest] = process.argv.slice(2);
  const opts = parseArgs(rest);

  if (command === "hide" && opts.secret && opts.cover) {
    const result = hide(opts.secret, opts.cover, opts.password);
    if (opts.out) {
      fs.writeFileSync(opts.out, result, "utf8");
      console.log(`${opts.out} файлд хадгаллаа`);
    } else {
      console.log(result);
    }
  } else if (command === "reveal" && (opts.text || opts.file)) {
    const text = opts.file ? fs.readFileSync(opts.file, "utf8") : opts.text;
    console.log(reveal(text, opts.password));
  } else {
    console.log(USAGE);
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`Алдаа: ${err.message}`);
  process.exitCode = 1;
}
