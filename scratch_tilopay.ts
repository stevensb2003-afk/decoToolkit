import { checkTransactionStatus } from "./src/lib/tilopay";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function run() {
  try {
    const res1 = await checkTransactionStatus("206044");
    console.log("206044 result:", JSON.stringify(res1, null, 2));
  } catch (err: any) {
    console.error("Error 206044:", err.message);
  }
}
run();
