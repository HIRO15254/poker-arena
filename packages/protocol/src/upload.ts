/**
 * アップロード型 bot(Python)の受け入れ規則。
 *
 * 目的は「データ量ではなくロジックで competing させること」。
 * 巨大な事前計算テーブルを同梱されると、勝負が計算資源と容量の勝負になってしまう。
 *
 * 数え方は **`#` コメントと空行は無料、それ以外は全部数える**。
 * docstring を含む文字列リテラルは数える — ここを免除すると、
 * レンジ表を docstring に置いて `__doc__` からパースする抜け道ができるため。
 * 長い説明を書きたいときは `#` コメントを使う。
 */

export interface UploadLimits {
  language: "python";
  pythonVersion: string;
  /** 提出できるファイル数 */
  maxFiles: number;
  /** コメントと空行を除いた UTF-8 バイト数の上限 */
  maxCodeBytes: number;
  /** ファイル全体の生バイト数の上限(コメントで水増しされても持て余さないための保険) */
  maxRawBytes: number;
}

export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  language: "python",
  pythonVersion: "3.12",
  maxFiles: 1,
  maxCodeBytes: 8 * 1024,
  maxRawBytes: 256 * 1024,
};

export interface CodeMeasurement {
  /** コメントと空行を除いた UTF-8 バイト数 */
  codeBytes: number;
  /** ファイル全体の UTF-8 バイト数 */
  rawBytes: number;
  /** 実質的なコード行数(コメントのみの行と空行を除く) */
  codeLines: number;
  /** 数えなかったバイト数(コメントと空行) */
  freeBytes: number;
}

const encoder = new TextEncoder();

/**
 * Python ソースからコメントと空行を落とす。
 *
 * 文字列リテラルの中の `#` はコメントではないので、簡易字句解析で追う。
 * シングル/ダブルクォート、三重クォート、エスケープに対応する。
 * f-string の入れ子など極端なケースは、閉じクォートの判定が保守的に働くだけで、
 * 上限判定が甘くなる方向には倒れない。
 */
export function stripPythonComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  let quote: string | null = null;
  let triple = false;

  while (i < n) {
    const c = source[i]!;
    if (quote === null) {
      if (c === "#") {
        // 行末までコメント
        while (i < n && source[i] !== "\n") i++;
        continue;
      }
      if (c === "'" || c === '"') {
        triple = source.slice(i, i + 3) === c + c + c;
        quote = c;
        const len = triple ? 3 : 1;
        out += source.slice(i, i + len);
        i += len;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    // 文字列の中
    if (c === "\\" && i + 1 < n) {
      out += source.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === quote) {
      if (triple) {
        if (source.slice(i, i + 3) === quote + quote + quote) {
          out += source.slice(i, i + 3);
          i += 3;
          quote = null;
          triple = false;
          continue;
        }
      } else {
        out += c;
        i++;
        quote = null;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

/** ソースを計測する。判定はすべてこの結果で行う */
export function measurePythonCode(source: string): CodeMeasurement {
  const rawBytes = encoder.encode(source).length;
  const stripped = stripPythonComments(source);
  const lines = stripped.split("\n").filter((line) => line.trim().length > 0);
  const code = lines.join("\n");
  const codeBytes = encoder.encode(code).length;
  return {
    codeBytes,
    rawBytes,
    codeLines: lines.length,
    freeBytes: rawBytes - codeBytes,
  };
}

export type UploadRejection =
  | { code: "too_long"; message: string; measurement: CodeMeasurement }
  | { code: "raw_too_large"; message: string; measurement: CodeMeasurement }
  | { code: "empty"; message: string; measurement: CodeMeasurement }
  | { code: "not_python"; message: string; measurement: CodeMeasurement };

export interface UploadCheck {
  ok: boolean;
  measurement: CodeMeasurement;
  rejection?: UploadRejection;
}

/** 提出された1ファイルが受け入れ条件を満たすか */
export function checkBotUpload(
  filename: string,
  source: string,
  limits: UploadLimits = DEFAULT_UPLOAD_LIMITS,
): UploadCheck {
  const measurement = measurePythonCode(source);

  if (!filename.toLowerCase().endsWith(".py")) {
    return {
      ok: false,
      measurement,
      rejection: {
        code: "not_python",
        message: "提出できるのは .py ファイル 1 つだけです",
        measurement,
      },
    };
  }
  if (measurement.codeLines === 0) {
    return {
      ok: false,
      measurement,
      rejection: { code: "empty", message: "コードが空です", measurement },
    };
  }
  if (measurement.rawBytes > limits.maxRawBytes) {
    return {
      ok: false,
      measurement,
      rejection: {
        code: "raw_too_large",
        message: `ファイルサイズが大きすぎます(${measurement.rawBytes} / 上限 ${limits.maxRawBytes} バイト)`,
        measurement,
      },
    };
  }
  if (measurement.codeBytes > limits.maxCodeBytes) {
    return {
      ok: false,
      measurement,
      rejection: {
        code: "too_long",
        message:
          `コードが長すぎます(${measurement.codeBytes} / 上限 ${limits.maxCodeBytes} バイト)。` +
          `# コメントと空行は数えません`,
        measurement,
      },
    };
  }
  return { ok: true, measurement };
}
