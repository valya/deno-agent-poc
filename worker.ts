import type { INodeExecutionData } from "n8n-workflow";

type FunctionType = (data: INodeExecutionData) => INodeExecutionData;

const buildFunction = (code: string): FunctionType => {
  const func = (async () => {}).constructor("data", code);
  return func;
};

self.onmessage = async (ev) => {
  const resultToken = crypto.randomUUID();
  const { code, data } = (ev.data) as {
    code: string;
    data: INodeExecutionData[];
  };
  self.postMessage({ resultToken });
  const func = buildFunction(code);

  const result: INodeExecutionData[] = [];
  for (const d of data) {
    result.push(await func(d));
  }
  self.postMessage({ resultToken, result });
};
