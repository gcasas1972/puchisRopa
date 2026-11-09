import { hash } from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const terminal = createInterface({ input: stdin, output: stdout });
try {
  const password = await terminal.question("Contraseña inicial del administrador (mínimo 12 caracteres): ");
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("La contraseña debe tener al menos 12 caracteres y no más de 72 bytes UTF-8.");
  }
  console.log(`\nADMIN_PASSWORD_HASH=${await hash(password, 12)}`);
} finally {
  terminal.close();
}
