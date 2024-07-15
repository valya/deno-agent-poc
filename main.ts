import type {
  AgentJobDoneResponse,
  AgentJobRequest,
  AgentRequest,
  AgentResponse,
} from "./types.ts";
import { assertNever } from "./utils.ts";

const socket = new WebSocket("ws://localhost:5678/rest/agent?id=testagent");

const sendMessage = (message: AgentResponse) => {
  socket.send(JSON.stringify(message));
};

const executeCode = async (
  job: AgentJobRequest,
): Promise<AgentJobDoneResponse["data"]> => {
  const worker = new Worker(import.meta.resolve("./worker.ts"), {
    type: "module",
    name: job.jobId,
    deno: {
      permissions: {
        env: false,
        ffi: false,
        hrtime: false,
        read: false,
        net: true,
        run: false,
        sys: false,
        write: false,
      },
    },
  });

  return new Promise((resolve, reject) => {
    let resultToken: string;
    worker.addEventListener("message", (ev) => {
      if (!resultToken) {
        resultToken = ev.data.resultToken;
        return;
      }

      if (ev.data.resultToken === resultToken) {
        resolve(ev.data.result);
        worker.terminate();
      }
    });

    worker.addEventListener("error", (ev) => {
      ev.preventDefault();
      reject(ev.error);
      worker.terminate();
    });

    worker.postMessage({
      code: job.settings.code,
      data: job.data,
    });
  });
};

socket.addEventListener("message", async (ev) => {
  const req: AgentRequest = JSON.parse(ev.data);

  switch (req.type) {
    case "info":
      sendMessage({
        type: "info",
        name: "Deno Test Agent",
        types: ["shell", "javascript", "typescript"],
      });
      break;

    case "job": {
      console.log(req);

      try {
        sendMessage({
          type: "jobdone",
          jobId: req.jobId,
          data: await executeCode(req),
        });
      } catch (error) {
        sendMessage({
          type: "joberror",
          jobId: req.jobId,
          error,
        });
      }

      break;
    }

    default:
      assertNever(req);
      break;
  }
});
