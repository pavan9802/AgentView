type ContentBlock = { type: string; text: string };

function isContentBlockArray(val: unknown): val is ContentBlock[] {
  return (
    Array.isArray(val) &&
    val.length > 0 &&
    typeof (val[0] as Record<string, unknown>)?.["text"] === "string"
  );
}

export function extractTextFromBlocks(val: unknown): string {
  if (typeof val === "string") return val;
  if (isContentBlockArray(val)) return val.map((b) => b.text).join("");
  return JSON.stringify(val);
}

export function formatToolInput(toolName: string, toolInputJson: string): string {
  let result = toolInputJson;
  try {
    const input = JSON.parse(toolInputJson) as Record<string, unknown>;
    switch (toolName) {
      case "Bash":
        result = typeof input["command"] === "string" ? input["command"] : toolInputJson;
        break;
      case "Read":
      case "Write":
      case "Edit":
      case "MultiEdit":
        result = typeof input["file_path"] === "string" ? input["file_path"] : toolInputJson;
        break;
      case "Glob": {
        const pattern = typeof input["pattern"] === "string" ? input["pattern"] : "";
        const path = typeof input["path"] === "string" ? ` in ${input["path"]}` : "";
        result = pattern ? `${pattern}${path}` : toolInputJson;
        break;
      }
      case "Grep": {
        const pattern = typeof input["pattern"] === "string" ? `"${input["pattern"]}"` : "";
        const path = typeof input["path"] === "string" ? ` in ${input["path"]}` : "";
        result = pattern ? `${pattern}${path}` : toolInputJson;
        break;
      }
      default:
        result = toolInputJson;
    }
  } catch {
    result = toolInputJson;
  }
  console.log("[formatToolInput]", { toolName, raw: toolInputJson, result });
  return result;
}

export function formatToolOutput(toolName: string, outputJson: string): string {
  let result: string;
  try {
    const parsed = JSON.parse(outputJson) as unknown;
    if (toolName === "Bash" && typeof parsed === "object" && parsed !== null) {
      const out = parsed as Record<string, unknown>;
      const stdout = extractTextFromBlocks(out["stdout"] ?? "");
      const stderr = extractTextFromBlocks(out["stderr"] ?? "");
      result = stdout.trim() !== "" ? stdout : stderr;
    } else {
      result = extractTextFromBlocks(parsed);
    }
  } catch {
    result = outputJson;
  }
  console.log("[formatToolOutput]", { toolName, raw: outputJson, result });
  return result;
}
