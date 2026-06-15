import { getRequestListener } from "@hono/node-server";
import { app } from "../src/app.js";

export const config = { api: { bodyParser: false } };
export default getRequestListener(app.fetch);
