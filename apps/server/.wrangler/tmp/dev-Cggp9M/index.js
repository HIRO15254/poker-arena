var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/utils/buffer.js
var bufferToFormData = /* @__PURE__ */ __name((arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
}, "bufferToFormData");

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/utils/body.js
var isRawRequest = /* @__PURE__ */ __name((request) => "headers" in request, "isRawRequest");
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) {
    return convertFormDataToBodyData(
      await request.bodyCache.formData,
      options
    );
  }
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str, "tryDecodeURIComponent");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return tryDecodeURIComponent(value);
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/request.js
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = tryDecodeURIComponent(value);
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    for (const anyCachedKey in bodyCache) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    ;
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   // Append multiple headers using the append option (e.g. Vary)
   *   c.header('Vary', 'Accept-Encoding', { append: true })
   *   c.header('Vary', 'User-Agent', { append: true })
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) {
        if (key === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) {
          if (++count > 1 || typeof headers[k] !== "string") {
            responseHeaders = new Headers();
            break;
          }
        }
      }
      if (responseHeaders) {
        for (const k in headers) {
          const v = headers[k];
          if (typeof v === "string") {
            responseHeaders.set(k, v);
          } else {
            responseHeaders.delete(k);
            for (const v2 of v) {
              responseHeaders.append(k, v2);
            }
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch", "query"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} env - env Object
   * @param {ExecutionContext} executionCtx - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return b === TAIL_WILDCARD_REG_EXP_STR ? -1 : 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  // handler index of a dynamic path, or -1 for a static path terminal
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : null : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
        if (name && pattern[2]) {
          if (regexpStr === ".*") {
            throw PATH_ERROR;
          }
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) {
            throw PATH_ERROR;
          }
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) {
            throw PATH_ERROR;
          }
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ONLY_WILDCARD_REG_EXP_STR && regexpStr !== TAIL_WILDCARD_REG_EXP_STR) {
            for (const k in node.#children) {
              if (
                // a single-char pattern coexists with single-char literals as a literal does
                (regexpStr.length > 1 || k.length > 1) && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
              ) {
                throw PATH_ERROR;
              }
            }
          }
          nextNode = node.#children[regexpStr] = new _Node();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) {
            if (k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
              throw PATH_ERROR;
            }
          }
          nextNode = node.#children[token] = new _Node();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) {
      throw PATH_ERROR;
    }
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  // dynamic path -> [handler index, param assoc]; static paths are not registered
  paths = /* @__PURE__ */ Object.create(null);
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#tries = { [METHOD_NAME_ALL]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
          this.#insertPath(method, p);
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      Object.keys(middleware).forEach((m) => {
        if ((method === METHOD_NAME_ALL || method === m) && !middleware[m][path]) {
          this.#insertPath(m, path);
          middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        }
      });
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          if (!routes[m][path2]) {
            this.#insertPath(m, path2);
            routes[m][path2] = [
              ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
            ];
          }
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = this.#tries = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = /* @__PURE__ */ Object.create(null);
    const handlerData = [];
    [middleware, routes].forEach((r) => {
      for (const path in r) {
        const handlers = r[path];
        const pathData = trie.paths[path];
        if (!pathData) {
          staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
          continue;
        }
        const paramAssoc = pathData[1];
        handlerData[pathData[0]] = handlers.map(([h, paramCount]) => {
          const paramIndexMap = /* @__PURE__ */ Object.create(null);
          paramCount -= 1;
          for (; paramCount >= 0; paramCount--) {
            const [key, value] = paramAssoc[paramCount];
            paramIndexMap[key] = value;
          }
          return [h, paramIndexMap];
        });
      }
    });
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (let i = 0, len = handlerData.length; i < len; i++) {
      for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
        const map = handlerData[i][j]?.[1];
        if (!map) {
          continue;
        }
        const keys = Object.keys(map);
        for (let k = 0, len3 = keys.length; k < len3; k++) {
          map[keys[k]] = paramReplacementMap[map[keys[k]]];
        }
      }
    }
    const handlerMap = [];
    for (const i in indexReplacementMap) {
      handlerMap[i] = handlerData[indexReplacementMap[i]];
    }
    return [regexp, handlerMap, staticMap];
  }
};

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var order = 0;
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods = [];
  #children = /* @__PURE__ */ Object.create(null);
  #patterns = [];
  #pattern;
  #params = emptyParams;
  insert(method, path, handler) {
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = /* @__PURE__ */ new Set();
    let i = 0;
    for (const p of parts) {
      const nextP = parts[++i];
      const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
      const isParam = Array.isArray(pattern);
      const key = isParam ? pattern[0] : pattern || p;
      const child = curNode.#children[key] ||= new _Node2();
      if (pattern && !child.#pattern) {
        child.#pattern = pattern;
        curNode.#patterns.push(child);
      }
      curNode = child;
      if (isParam) {
        possibleKeys.add(pattern[1]);
      }
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: [...possibleKeys],
        score: ++order
      }
    });
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      if (handlerSet) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
          const key = handlerSet.possibleKeys[i2];
          handlerSet.params[key] = params?.[key] && !i2 ? params[key] : nodeParams[key] ?? params?.[key];
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (const child of node.#patterns) {
          const pattern = child.#pattern;
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (typeof pattern === "string") {
            if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
              this.#pushHandlerSets(handlerSets, child, method, node.#params);
              if (pattern === "*") {
                child.#params = params;
                tempNodes.push(child);
              }
            }
            continue;
          }
          const [, name, matcher] = pattern;
          if (!part && matcher === true) {
            continue;
          }
          if (matcher !== true) {
            if (!partOffsets) {
              partOffsets = [];
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.slice(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  node.#params,
                  params
                );
              }
              for (const _ in child.#children) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
                break;
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets[1]) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node = new Node2();
  add(method, path, handler) {
    for (const result of checkOptionalParameter(path) || [path]) {
      this.#node.insert(method, result, handler);
    }
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// ../../node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "QUERY"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const exposeHeadersStr = opts.exposeHeaders?.length ? opts.exposeHeaders.join(",") : void 0;
  const allowHeadersStr = opts.allowHeaders?.length ? opts.allowHeaders.join(",") : void 0;
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return async (origin, c) => (await optsAllowMethods(origin, c)).join(",");
    } else if (Array.isArray(optsAllowMethods)) {
      const methodsStr = optsAllowMethods.join(",");
      return () => methodsStr;
    } else {
      return () => "";
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (exposeHeadersStr) {
      set("Access-Control-Expose-Headers", exposeHeadersStr);
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        c.res.headers.append("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods) {
        set("Access-Control-Allow-Methods", allowMethods);
      }
      let headersStr = allowHeadersStr;
      if (!headersStr) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headersStr = requestHeaders.split(",").map((h) => h.trim()).join(",");
        }
      }
      if (headersStr) {
        set("Access-Control-Allow-Headers", headersStr);
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// ../../packages/protocol/src/constants.ts
var CHIPS_PER_BB = 100;

// ../../packages/protocol/src/season.ts
var DEFAULT_RAKE = {
  percent: 5,
  capChips: 4 * CHIPS_PER_BB,
  noFlopNoDrop: true
};
function seasonOneConfig(startsAt, endsAt) {
  return {
    id: "s1",
    name: "Season 1 \u2014 Heads-Up NLH",
    format: "hu",
    seats: 2,
    startingStackBb: 100,
    smallBlind: CHIPS_PER_BB / 2,
    bigBlind: CHIPS_PER_BB,
    rake: DEFAULT_RAKE,
    startsAt,
    endsAt,
    minHandsForLeaderboard: 1e4,
    official: true
  };
}
__name(seasonOneConfig, "seasonOneConfig");

// ../../packages/engine/src/cards.ts
var RANKS = "23456789TJQKA";
var SUITS = "cdhs";
function cardToString(c) {
  return `${RANKS[c >> 2]}${SUITS[c & 3]}`;
}
__name(cardToString, "cardToString");
function parseCard(s) {
  const rank = RANKS.indexOf(s[0]);
  const suit = SUITS.indexOf(s[1]);
  if (s.length !== 2 || rank < 0 || suit < 0) throw new Error(`invalid card: ${s}`);
  return rank * 4 + suit;
}
__name(parseCard, "parseCard");
function freshDeck() {
  return Array.from({ length: 52 }, (_, i) => i);
}
__name(freshDeck, "freshDeck");

// ../../packages/engine/src/rng.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
__name(mulberry32, "mulberry32");
function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
__name(shuffleInPlace, "shuffleInPlace");

// ../../packages/engine/src/evaluator.ts
function evaluate5(cards) {
  const ranks = cards.map((c) => c >> 2).sort((a, b) => b - a);
  const suits = cards.map((c) => c & 3);
  const isFlush = suits.every((s) => s === suits[0]);
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = -1;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 12 && uniq[1] === 3 && uniq[4] === 0) straightHigh = 3;
  }
  const counts = /* @__PURE__ */ new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  let category;
  let tiebreak;
  if (straightHigh >= 0 && isFlush) {
    category = 8;
    tiebreak = [straightHigh];
  } else if (groups[0][1] === 4) {
    category = 7;
    tiebreak = [groups[0][0], groups[1][0]];
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    category = 6;
    tiebreak = [groups[0][0], groups[1][0]];
  } else if (isFlush) {
    category = 5;
    tiebreak = ranks;
  } else if (straightHigh >= 0) {
    category = 4;
    tiebreak = [straightHigh];
  } else if (groups[0][1] === 3) {
    category = 3;
    tiebreak = [groups[0][0], groups[1][0], groups[2][0]];
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    category = 2;
    tiebreak = [groups[0][0], groups[1][0], groups[2][0]];
  } else if (groups[0][1] === 2) {
    category = 1;
    tiebreak = [groups[0][0], groups[1][0], groups[2][0], groups[3][0]];
  } else {
    category = 0;
    tiebreak = ranks;
  }
  let score = category;
  for (let i = 0; i < 5; i++) score = score * 13 + (tiebreak[i] ?? 0);
  return score;
}
__name(evaluate5, "evaluate5");
var COMBOS_7C5 = (() => {
  const out = [];
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 4; b++)
      for (let c = b + 1; c < 5; c++)
        for (let d = c + 1; d < 6; d++)
          for (let e = d + 1; e < 7; e++) out.push([a, b, c, d, e]);
  return out;
})();
function evaluate7(cards) {
  if (cards.length !== 7) throw new Error(`evaluate7 expects 7 cards, got ${cards.length}`);
  let best = -1;
  const buf = [0, 0, 0, 0, 0];
  for (const combo of COMBOS_7C5) {
    for (let i = 0; i < 5; i++) buf[i] = cards[combo[i]];
    const s = evaluate5(buf);
    if (s > best) best = s;
  }
  return best;
}
__name(evaluate7, "evaluate7");
var CATEGORY_NAMES = [
  "high card",
  "pair",
  "two pair",
  "trips",
  "straight",
  "flush",
  "full house",
  "quads",
  "straight flush"
];
function categoryOf(score) {
  return CATEGORY_NAMES[Math.floor(score / 13 ** 5)];
}
__name(categoryOf, "categoryOf");

// ../../packages/engine/src/engine.ts
var STREETS = ["preflop", "flop", "turn", "river"];
async function playHand(config, agents) {
  const n = config.seats.length;
  if (n < 2 || n > 9) throw new Error(`seat count must be 2..9, got ${n}`);
  if (agents.length !== n) throw new Error("agents length must match seats length");
  const handId = config.handId ?? `h_${(config.seed ?? 0).toString(36)}`;
  const seats = config.seats.map((s, i) => ({
    idx: i,
    id: s.id,
    stack: s.stack,
    streetBet: 0,
    committed: 0,
    folded: false,
    allIn: false,
    hole: [],
    won: 0,
    showedDown: false
  }));
  const events = [];
  const actionLog = [];
  const board = [];
  const deck = config.deck ? [...config.deck] : shuffleInPlace(freshDeck(), mulberry32(config.seed ?? 1));
  let deckPos = 0;
  const draw = /* @__PURE__ */ __name(() => {
    const c = deck[deckPos++];
    if (c === void 0) throw new Error("deck exhausted");
    return c;
  }, "draw");
  const seatAfter = /* @__PURE__ */ __name((i, steps = 1) => (i + steps) % n, "seatAfter");
  const nextWhere = /* @__PURE__ */ __name((from, cond) => {
    for (let k = 0; k < n; k++) {
      const i = seatAfter(from, k + 1);
      if (cond(seats[i])) return i;
    }
    return -1;
  }, "nextWhere");
  const headsUp = n === 2;
  const sbSeat = headsUp ? config.button : seatAfter(config.button);
  const bbSeat = headsUp ? seatAfter(config.button) : seatAfter(config.button, 2);
  const put = /* @__PURE__ */ __name((seat, amount) => {
    const real = Math.min(amount, seat.stack);
    seat.stack -= real;
    seat.streetBet += real;
    seat.committed += real;
    if (seat.stack === 0) seat.allIn = true;
    return real;
  }, "put");
  {
    const sb = seats[sbSeat];
    const bb = seats[bbSeat];
    const sbAmt = put(sb, config.smallBlind);
    events.push({ type: "blind", seat: sbSeat, kind: "sb", amount: sbAmt });
    actionLog.push({ seat: sbSeat, street: "preflop", action: "post_sb", amount: sbAmt, ...sb.allIn ? { all_in: true } : {} });
    const bbAmt = put(bb, config.bigBlind);
    events.push({ type: "blind", seat: bbSeat, kind: "bb", amount: bbAmt });
    actionLog.push({ seat: bbSeat, street: "preflop", action: "post_bb", amount: bbAmt, ...bb.allIn ? { all_in: true } : {} });
  }
  for (let round = 0; round < 2; round++) {
    for (let k = 0; k < n; k++) {
      const i = headsUp ? seatAfter(config.button, k) : seatAfter(config.button, k + 1);
      seats[i].hole.push(draw());
    }
  }
  const contenders = /* @__PURE__ */ __name(() => seats.filter((s) => !s.folded), "contenders");
  const canAct = /* @__PURE__ */ __name(() => seats.filter((s) => !s.folded && !s.allIn), "canAct");
  const totalPot = /* @__PURE__ */ __name(() => seats.reduce((a, s) => a + s.committed, 0), "totalPot");
  const buildRequest = /* @__PURE__ */ __name((seat, street, legal) => {
    const players = seats.map((s) => ({
      seat: s.idx,
      stack: s.stack,
      bet: s.streetBet,
      status: s.folded ? "folded" : s.allIn ? "allin" : "active"
    }));
    return {
      type: "act",
      hand_id: handId,
      seat: seat.idx,
      hole_cards: seat.hole.map(cardToString),
      board: board.map(cardToString),
      street,
      pot: totalPot(),
      players,
      actions: [...actionLog],
      legal_actions: legal
    };
  }, "buildRequest");
  const bettingRound = /* @__PURE__ */ __name(async (street) => {
    let currentBet = street === "preflop" ? config.bigBlind : 0;
    let lastFullRaise = config.bigBlind;
    const actedSinceFullRaise = /* @__PURE__ */ new Set();
    const start = street === "preflop" ? headsUp ? config.button : seatAfter(config.button, 3) : nextWhere(config.button, (s) => !s.folded && !s.allIn);
    if (start < 0) return;
    const pending = [];
    const pushOrderFrom = /* @__PURE__ */ __name((from, include) => {
      for (let k = 0; k < n; k++) {
        const i = (from + k) % n;
        const s = seats[i];
        if (include(s) && !pending.includes(i)) pending.push(i);
      }
    }, "pushOrderFrom");
    pushOrderFrom(start, (s) => !s.folded && !s.allIn);
    while (pending.length > 0) {
      if (contenders().length <= 1) return;
      const idx = pending.shift();
      const seat = seats[idx];
      if (seat.folded || seat.allIn) continue;
      const toCall = currentBet - seat.streetBet;
      const legal = [];
      if (toCall > 0) legal.push({ action: "fold" });
      if (toCall === 0) legal.push({ action: "check" });
      else legal.push({ action: "call", amount: Math.min(toCall, seat.stack) });
      const maxRaiseTo = seat.streetBet + seat.stack;
      const minRaiseTo = Math.min(currentBet + lastFullRaise, maxRaiseTo);
      const raiseAllowed = maxRaiseTo > currentBet && !(toCall > 0 && actedSinceFullRaise.has(idx));
      if (raiseAllowed) legal.push({ action: "raise", min: minRaiseTo, max: maxRaiseTo });
      let res;
      let forced = false;
      try {
        res = await agents[idx](buildRequest(seat, street, legal));
      } catch {
        res = { action: "fold" };
        forced = true;
      }
      const normalized = normalize(res, legal);
      if (normalized === null) {
        forced = true;
        res = toCall === 0 ? { action: "check" } : { action: "fold" };
      } else {
        res = normalized;
      }
      if (res.action === "fold") {
        seat.folded = true;
        record(idx, street, "fold", void 0, seat, forced);
      } else if (res.action === "check") {
        actedSinceFullRaise.add(idx);
        record(idx, street, "check", void 0, seat, forced);
      } else if (res.action === "call") {
        put(seat, toCall);
        actedSinceFullRaise.add(idx);
        record(idx, street, "call", seat.streetBet, seat, forced);
      } else {
        const raiseTo2 = res.amount;
        const raiseSize = raiseTo2 - currentBet;
        put(seat, raiseTo2 - seat.streetBet);
        const isFullRaise = raiseSize >= lastFullRaise;
        if (isFullRaise) {
          lastFullRaise = raiseSize;
          actedSinceFullRaise.clear();
        }
        actedSinceFullRaise.add(idx);
        const kind = currentBet === 0 ? "bet" : "raise";
        currentBet = raiseTo2;
        record(idx, street, kind, raiseTo2, seat, forced);
        pending.length = 0;
        pushOrderFrom(seatAfter(idx), (s) => !s.folded && !s.allIn && s.idx !== idx);
      }
    }
  }, "bettingRound");
  const record = /* @__PURE__ */ __name((seatIdx, street, action, amount, seat, forced) => {
    const rec = {
      seat: seatIdx,
      street,
      action,
      ...amount !== void 0 ? { amount } : {},
      ...seat.allIn && action !== "fold" && action !== "check" ? { all_in: true } : {},
      ...forced ? { forced: true } : {}
    };
    actionLog.push(rec);
    events.push({ type: "action", record: rec });
  }, "record");
  const normalize = /* @__PURE__ */ __name((res, legal) => {
    if (!res || typeof res !== "object") return null;
    if (res.action === "fold") return legal.some((l) => l.action === "fold") ? res : null;
    if (res.action === "check") return legal.some((l) => l.action === "check") ? res : null;
    if (res.action === "call") return legal.some((l) => l.action === "call") ? res : null;
    if (res.action === "raise") {
      const r = legal.find((l) => l.action === "raise");
      if (!r || r.action !== "raise") return null;
      if (!Number.isInteger(res.amount)) return null;
      if (res.amount < r.min || res.amount > r.max) return null;
      return res;
    }
    return null;
  }, "normalize");
  for (const street of STREETS) {
    if (contenders().length <= 1) break;
    if (street !== "preflop") {
      const count = street === "flop" ? 3 : 1;
      const cards = [];
      for (let i = 0; i < count; i++) cards.push(draw());
      board.push(...cards);
      events.push({ type: "deal", street, cards: cards.map(cardToString) });
    }
    seats.forEach((s) => s.streetBet = 0);
    if (street === "preflop") {
      seats[sbSeat].streetBet = seats[sbSeat].committed;
      seats[bbSeat].streetBet = seats[bbSeat].committed;
    }
    if (canAct().length > 1) {
      await bettingRound(street);
    }
  }
  const pot = totalPot();
  const flopDealt = board.length >= 3;
  const rakeTotal = config.rake.noFlopNoDrop && !flopDealt ? 0 : Math.min(Math.floor(pot * config.rake.percent / 100), config.rake.capChips);
  const alive = contenders();
  if (alive.length === 1) {
    const winner = alive[0];
    const amount = pot - rakeTotal;
    winner.stack += amount;
    winner.won += amount;
    if (rakeTotal > 0) events.push({ type: "rake", amount: rakeTotal });
    events.push({ type: "win", seat: winner.idx, amount, potIndex: 0 });
  } else {
    const scores = /* @__PURE__ */ new Map();
    for (const s of alive) {
      const score = evaluate7([...s.hole, ...board]);
      scores.set(s.idx, score);
      s.showedDown = true;
      events.push({ type: "showdown", seat: s.idx, cards: s.hole.map(cardToString), score });
    }
    if (rakeTotal > 0) events.push({ type: "rake", amount: rakeTotal });
    const levels = [...new Set(seats.filter((s) => s.committed > 0).map((s) => s.committed))].sort((a, b) => a - b);
    let prev = 0;
    let rakeLeft = rakeTotal;
    let potIndex = 0;
    for (const level of levels) {
      let amount = 0;
      for (const s of seats) amount += Math.max(0, Math.min(s.committed, level) - prev);
      prev = level;
      if (amount === 0) continue;
      const rakeHere = Math.min(rakeLeft, amount);
      rakeLeft -= rakeHere;
      amount -= rakeHere;
      const eligible = alive.filter((s) => s.committed >= level);
      if (eligible.length === 0 || amount === 0) continue;
      let best = -1;
      for (const s of eligible) best = Math.max(best, scores.get(s.idx));
      const winners = eligible.filter((s) => scores.get(s.idx) === best).sort((a, b) => distFromButton(a.idx) - distFromButton(b.idx));
      const share = Math.floor(amount / winners.length);
      let remainder = amount - share * winners.length;
      for (const w of winners) {
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        const winAmount = share + extra;
        w.stack += winAmount;
        w.won += winAmount;
        events.push({ type: "win", seat: w.idx, amount: winAmount, potIndex });
      }
      potIndex++;
    }
  }
  function distFromButton(idx) {
    return (idx - config.button - 1 + n) % n;
  }
  __name(distFromButton, "distFromButton");
  return {
    handId,
    board: board.map(cardToString),
    totalPot: pot,
    rake: rakeTotal,
    events,
    seats: seats.map((s) => ({
      seat: s.idx,
      id: s.id,
      holeCards: s.hole.map(cardToString),
      committed: s.committed,
      won: s.won,
      net: s.won - s.committed,
      folded: s.folded,
      showedDown: s.showedDown
    }))
  };
}
__name(playHand, "playHand");

// src/season.ts
function currentSeason(now = /* @__PURE__ */ new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const config = seasonOneConfig(start.toISOString(), end.toISOString());
  config.minHandsForLeaderboard = 2e3;
  return config;
}
__name(currentSeason, "currentSeason");

// ../../packages/simulator/src/bots.ts
var legalOf = /* @__PURE__ */ __name((req) => {
  const call = req.legal_actions.find((l) => l.action === "call");
  const raise = req.legal_actions.find((l) => l.action === "raise");
  return {
    fold: req.legal_actions.some((l) => l.action === "fold"),
    check: req.legal_actions.some((l) => l.action === "check"),
    call: call?.action === "call" ? call : void 0,
    raise: raise?.action === "raise" ? raise : void 0
  };
}, "legalOf");
function sanitize(res, L) {
  const fallback = /* @__PURE__ */ __name(() => L.check ? { action: "check" } : L.fold ? { action: "fold" } : L.call ? { action: "call" } : { action: "fold" }, "fallback");
  if (!res || typeof res !== "object") return fallback();
  if (res.action === "raise") {
    if (L.raise) {
      const n = Math.round(res.amount);
      const amount = Number.isFinite(n) ? Math.max(L.raise.min, Math.min(L.raise.max, n)) : L.raise.min;
      return { action: "raise", amount };
    }
    return L.call ? { action: "call" } : fallback();
  }
  if (res.action === "call") return L.call ? { action: "call" } : fallback();
  if (res.action === "check") return L.check ? { action: "check" } : fallback();
  if (res.action === "fold") return L.fold ? { action: "fold" } : fallback();
  return fallback();
}
__name(sanitize, "sanitize");
function safeAgent(decide) {
  return (req) => {
    let L = { fold: false, check: false };
    try {
      L = legalOf(req);
    } catch {
      return { action: "fold" };
    }
    try {
      return sanitize(decide(req, L), L);
    } catch {
      return sanitize(void 0, L);
    }
  };
}
__name(safeAgent, "safeAgent");
function roll(seed, req, salt) {
  let h = (2166136261 ^ seed >>> 0) >>> 0;
  const s = `${req.hand_id}|${req.seat}|${salt}`;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return mulberry32(h)();
}
__name(roll, "roll");
var STREET_SALT = { preflop: 10, flop: 20, turn: 30, river: 40 };
var RANK_LABELS = "23456789TJQKA";
function handKey(hi, lo, suited) {
  return hi === lo ? `${RANK_LABELS[hi]}${RANK_LABELS[lo]}` : `${RANK_LABELS[hi]}${RANK_LABELS[lo]}${suited ? "s" : "o"}`;
}
__name(handKey, "handKey");
function chenScore(hi, lo, suited) {
  const pts = /* @__PURE__ */ __name((r) => r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2, "pts");
  const pair = hi === lo;
  let score = pts(hi);
  if (pair) score = Math.max(score * 2, 5);
  if (suited) score += 2;
  if (!pair) {
    const gap = hi - lo - 1;
    if (gap === 1) score -= 1;
    else if (gap === 2) score -= 2;
    else if (gap === 3) score -= 4;
    else if (gap >= 4) score -= 5;
    if (gap <= 1 && hi < 10) score += 1;
  }
  return score;
}
__name(chenScore, "chenScore");
var TOP_FRACTION = (() => {
  const rows = [];
  for (let hi = 0; hi < 13; hi++) {
    for (let lo = 0; lo <= hi; lo++) {
      if (hi === lo) {
        rows.push({ key: handKey(hi, lo, false), chen: chenScore(hi, lo, false), hi, lo, suited: false, combos: 6 });
      } else {
        rows.push({ key: handKey(hi, lo, true), chen: chenScore(hi, lo, true), hi, lo, suited: true, combos: 4 });
        rows.push({ key: handKey(hi, lo, false), chen: chenScore(hi, lo, false), hi, lo, suited: false, combos: 12 });
      }
    }
  }
  rows.sort(
    (a, b) => b.chen - a.chen || b.hi - a.hi || b.lo - a.lo || Number(b.suited) - Number(a.suited)
  );
  const total = rows.reduce((acc, r) => acc + r.combos, 0);
  const map = /* @__PURE__ */ new Map();
  let cum = 0;
  for (const r of rows) {
    cum += r.combos;
    map.set(r.key, cum / total);
  }
  return map;
})();
function preflopTop(hole) {
  const a = hole[0];
  const b = hole[1];
  if (a === void 0 || b === void 0) return 1;
  const r1 = a >> 2;
  const r2 = b >> 2;
  const hi = Math.max(r1, r2);
  const lo = Math.min(r1, r2);
  const suited = hi !== lo && (a & 3) === (b & 3);
  return TOP_FRACTION.get(handKey(hi, lo, suited)) ?? 1;
}
__name(preflopTop, "preflopTop");
var CATEGORY_INDEX = {
  "high card": 0,
  pair: 1,
  "two pair": 2,
  trips: 3,
  straight: 4,
  flush: 5,
  "full house": 6,
  quads: 7,
  "straight flush": 8
};
function bestScore(cards) {
  const n = cards.length;
  if (n < 5) return -1;
  if (n === 5) return evaluate5(cards);
  if (n === 7) return evaluate7(cards);
  let best = -1;
  for (let skip = 0; skip < n; skip++) {
    const sub = [];
    for (let i = 0; i < n; i++) if (i !== skip) sub.push(cards[i]);
    const s = evaluate5(sub);
    if (s > best) best = s;
  }
  return best;
}
__name(bestScore, "bestScore");
function categoryIndex(score) {
  return CATEGORY_INDEX[categoryOf(score)];
}
__name(categoryIndex, "categoryIndex");
function hasStraight(ranks) {
  for (let high = 3; high <= 12; high++) {
    let ok = true;
    for (let k = 0; k < 5; k++) {
      const r = high - k;
      if (!ranks.has(r === -1 ? 12 : r)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}
__name(hasStraight, "hasStraight");
function straightOuts(ranks) {
  if (hasStraight(ranks)) return 0;
  let outs = 0;
  for (let r = 0; r < 13; r++) {
    if (ranks.has(r)) continue;
    const t = new Set(ranks);
    t.add(r);
    if (hasStraight(t)) outs++;
  }
  return outs;
}
__name(straightOuts, "straightOuts");
function hasFlushDraw(hole, board) {
  const all = [0, 0, 0, 0];
  const mine = [0, 0, 0, 0];
  for (const c of board) all[c & 3]++;
  for (const c of hole) {
    all[c & 3]++;
    mine[c & 3]++;
  }
  for (let s = 0; s < 4; s++) if (all[s] === 4 && mine[s] >= 1) return true;
  return false;
}
__name(hasFlushDraw, "hasFlushDraw");
function postflopStrength(hole, board) {
  if (board.length < 3 || hole.length < 2) return 0;
  const all = [...hole, ...board];
  const score = bestScore(all);
  if (score < 0) return 0;
  const cat = categoryIndex(score);
  const hr = [hole[0] >> 2, hole[1] >> 2].sort((a, b) => b - a);
  const boardRankList = board.map((c) => c >> 2);
  const boardRanks = [...new Set(boardRankList)].sort((a, b) => b - a);
  const countOnBoard = /* @__PURE__ */ __name((r) => boardRankList.filter((x) => x === r).length, "countOnBoard");
  const pocket = hr[0] === hr[1];
  let base;
  if (cat >= 6) {
    base = 0.98;
  } else if (cat === 5) {
    base = 0.93;
  } else if (cat === 4) {
    base = 0.9;
  } else if (cat === 3) {
    base = boardRanks.some((r) => countOnBoard(r) >= 3) ? 0.55 : 0.87;
  } else if (cat === 2) {
    const boardPairs = boardRanks.filter((r) => countOnBoard(r) >= 2).length;
    base = boardPairs >= 2 ? 0.3 : boardPairs === 1 ? 0.55 : 0.78;
  } else if (cat === 1) {
    if (pocket) {
      const top = boardRanks[0] ?? -1;
      const second = boardRanks[1] ?? -1;
      if (hr[0] > top) base = 0.74;
      else if (hr[0] > second) base = 0.5;
      else base = 0.34;
    } else {
      const hit = hr.filter((r) => boardRanks.includes(r));
      const pairedRank = hit[0];
      if (pairedRank === void 0) {
        base = hr[0] === 12 ? 0.24 : hr[0] >= 10 ? 0.19 : 0.14;
      } else {
        const idx = boardRanks.indexOf(pairedRank);
        const kicker = hr[0] === pairedRank ? hr[1] : hr[0];
        if (idx === 0) base = 0.6 + (kicker === 12 ? 0.1 : kicker >= 10 ? 0.06 : kicker >= 8 ? 0.03 : 0);
        else if (idx === 1) base = 0.46;
        else base = 0.34;
      }
    }
  } else {
    base = hr[0] === 12 ? 0.22 : hr[0] >= 10 ? 0.16 : 0.1;
  }
  if (board.length === 5 && bestScore(board) === score) base = Math.min(base, 0.15);
  if (board.length === 3 || board.length === 4) {
    let bonus = 0;
    if (cat < 4) {
      const allRanks = new Set(all.map((c) => c >> 2));
      const bRanks = new Set(boardRankList);
      const outs = Math.max(0, straightOuts(allRanks) - straightOuts(bRanks));
      if (hasFlushDraw(hole, board)) bonus += 0.2;
      if (outs >= 2) bonus += 0.16;
      else if (outs === 1) bonus += 0.06;
      if (cat === 0 && bonus === 0 && hr[1] > (boardRanks[0] ?? 12)) bonus += 0.06;
    }
    base = Math.min(0.92, base + bonus);
  }
  return base;
}
__name(postflopStrength, "postflopStrength");
function holeOf(req) {
  return req.hole_cards.map(parseCard);
}
__name(holeOf, "holeOf");
function boardOf(req) {
  return req.board.map(parseCard);
}
__name(boardOf, "boardOf");
function meOf(req) {
  return req.players.find((p) => p.seat === req.seat);
}
__name(meOf, "meOf");
function bigBlindOf(req) {
  const bb = req.actions.find((a) => a.action === "post_bb")?.amount;
  return bb && bb > 0 ? bb : 100;
}
__name(bigBlindOf, "bigBlindOf");
function isButton(req) {
  const sb = req.actions.find((a) => a.action === "post_sb");
  return sb ? sb.seat === req.seat : false;
}
__name(isButton, "isButton");
function hasInitiative(req) {
  for (let i = req.actions.length - 1; i >= 0; i--) {
    const a = req.actions[i];
    if (a.action === "bet" || a.action === "raise") return a.seat === req.seat;
  }
  return false;
}
__name(hasInitiative, "hasInitiative");
function raisesThisStreet(req) {
  return req.actions.filter((a) => a.street === req.street && (a.action === "bet" || a.action === "raise")).length;
}
__name(raisesThisStreet, "raisesThisStreet");
function raiseTo(L, amount) {
  if (!L.raise) return { action: "call" };
  const n = Math.round(amount);
  return {
    action: "raise",
    amount: Math.max(L.raise.min, Math.min(L.raise.max, Number.isFinite(n) ? n : L.raise.min))
  };
}
__name(raiseTo, "raiseTo");
function potRaise(req, L, fraction) {
  const toCall = L.call?.amount ?? 0;
  const myBet = meOf(req)?.bet ?? 0;
  return raiseTo(L, myBet + toCall + fraction * (req.pot + toCall));
}
__name(potRaise, "potRaise");
var TIGHT = {
  openTop: 0.82,
  openBb: 2.5,
  limpTop: 0.82,
  isoTop: 0.45,
  isoBb: 3.5,
  threeBetTop: 0.13,
  defendTop: 0.6,
  fourBetTop: 0.04,
  call3betTop: 0.2,
  call4betTop: 0.03,
  betSize: 0.62,
  bluffSize: 0.55,
  valueBet: 0.58,
  semiBluff: 0.3,
  giveUp: 0.28,
  raiseValue: 0.82,
  callMargin: 0.06,
  bluffFreq: 0.12,
  bluffRaiseFreq: 0.04
};
var LAG = {
  openTop: 0.96,
  openBb: 2.5,
  limpTop: 0.96,
  isoTop: 0.7,
  isoBb: 3.5,
  threeBetTop: 0.26,
  defendTop: 0.82,
  fourBetTop: 0.075,
  call3betTop: 0.36,
  call4betTop: 0.05,
  betSize: 0.78,
  bluffSize: 0.8,
  valueBet: 0.46,
  semiBluff: 0.2,
  giveUp: 0.36,
  raiseValue: 0.72,
  callMargin: -0.01,
  bluffFreq: 0.5,
  bluffRaiseFreq: 0.18
};
var BALANCED = {
  openTop: 0.88,
  openBb: 2.5,
  limpTop: 0.88,
  isoTop: 0.55,
  isoBb: 3.5,
  threeBetTop: 0.18,
  defendTop: 0.68,
  fourBetTop: 0.055,
  call3betTop: 0.27,
  call4betTop: 0.035,
  betSize: 0.66,
  bluffSize: 0.62,
  valueBet: 0.52,
  semiBluff: 0.26,
  giveUp: 0.32,
  raiseValue: 0.78,
  callMargin: 0.03,
  bluffFreq: 0.3,
  bluffRaiseFreq: 0.1
};
function preflopDecision(req, L, style, hole) {
  const bb = bigBlindOf(req);
  const top = preflopTop(hole);
  const raises = raisesThisStreet(req);
  const toCall = L.call?.amount ?? 0;
  const myStack = meOf(req)?.stack ?? 0;
  if (raises === 0) {
    if (toCall > 0) {
      if (top <= style.openTop && L.raise) return raiseTo(L, style.openBb * bb);
      if (top <= style.limpTop && L.call) return { action: "call" };
      return { action: "fold" };
    }
    if (top <= style.isoTop && L.raise) return raiseTo(L, style.isoBb * bb);
    return { action: "check" };
  }
  const commit = toCall / Math.max(1, myStack + toCall);
  const tighten = commit > 0.5 ? 0.35 : commit > 0.25 ? 0.65 : 1;
  if (raises === 1) {
    if (top <= style.threeBetTop && L.raise) return potRaise(req, L, 1);
    if (top <= style.defendTop * tighten && L.call) return { action: "call" };
    return L.check ? { action: "check" } : { action: "fold" };
  }
  if (raises === 2) {
    if (top <= style.fourBetTop && L.raise) return potRaise(req, L, 0.6);
    if (top <= style.call3betTop * tighten && L.call) return { action: "call" };
    return L.check ? { action: "check" } : { action: "fold" };
  }
  if (top <= style.call4betTop * 0.6 && L.raise) return raiseTo(L, L.raise.max);
  if (top <= style.call4betTop && L.call) return { action: "call" };
  return L.check ? { action: "check" } : { action: "fold" };
}
__name(preflopDecision, "preflopDecision");
function postflopDecision(req, L, style, seed, hole, board) {
  const s = postflopStrength(hole, board);
  const toCall = L.call?.amount ?? 0;
  const myStack = meOf(req)?.stack ?? 0;
  const aggressor = hasInitiative(req);
  const ip = isButton(req);
  const salt = STREET_SALT[req.street];
  const bluffRoll = roll(seed, req, salt);
  const raiseRoll = roll(seed, req, salt + 1);
  if (toCall === 0) {
    if (!L.raise) return { action: "check" };
    if (s >= style.valueBet) return potRaise(req, L, style.betSize);
    if (aggressor && req.street !== "river" && s >= style.semiBluff) return potRaise(req, L, style.betSize);
    if (s < style.giveUp && (aggressor || ip) && bluffRoll < style.bluffFreq) {
      return potRaise(req, L, style.bluffSize);
    }
    return { action: "check" };
  }
  const price = toCall / Math.max(1, req.pot + toCall);
  const commit = toCall / Math.max(1, myStack + toCall);
  const need = price + style.callMargin + 0.18 * commit;
  if (L.raise && s >= style.raiseValue) return potRaise(req, L, style.betSize);
  if (s >= need) return { action: "call" };
  if (L.raise && req.street !== "river" && s < style.giveUp && commit < 0.4 && raiseRoll < style.bluffRaiseFreq) {
    return potRaise(req, L, style.bluffSize);
  }
  return L.check ? { action: "check" } : { action: "fold" };
}
__name(postflopDecision, "postflopDecision");
function styleBot(style, seed) {
  return safeAgent((req, L) => {
    const hole = holeOf(req);
    if (hole.length < 2) return void 0;
    if (req.street === "preflop") return preflopDecision(req, L, style, hole);
    return postflopDecision(req, L, style, seed, hole, boardOf(req));
  });
}
__name(styleBot, "styleBot");
function checkFoldBot() {
  return safeAgent((_req, L) => L.check ? { action: "check" } : { action: "fold" });
}
__name(checkFoldBot, "checkFoldBot");
function callBot() {
  return safeAgent((_req, L) => {
    if (L.call) return { action: "call" };
    if (L.check) return { action: "check" };
    return { action: "fold" };
  });
}
__name(callBot, "callBot");
function randomBot(seed) {
  const rng = mulberry32(seed);
  return safeAgent((_req, L) => {
    const r = rng();
    if (L.raise && r < 0.25) return { action: "raise", amount: L.raise.min };
    if (r < 0.85) {
      if (L.call) return { action: "call" };
      if (L.check) return { action: "check" };
    }
    if (L.check) return { action: "check" };
    return { action: "fold" };
  });
}
__name(randomBot, "randomBot");
function aggroBot(seed) {
  const rng = mulberry32(seed);
  return safeAgent((req, L) => {
    if (L.raise) {
      const r = rng();
      if (r < 0.5) {
        const target = r < 0.15 ? Math.min(L.raise.max, L.raise.min + req.pot) : L.raise.min;
        return { action: "raise", amount: target };
      }
    }
    if (L.call) return { action: "call" };
    if (L.check) return { action: "check" };
    return { action: "fold" };
  });
}
__name(aggroBot, "aggroBot");
function tightBot(seed = 0) {
  return styleBot(TIGHT, seed);
}
__name(tightBot, "tightBot");
function lagBot(seed) {
  return styleBot(LAG, seed);
}
__name(lagBot, "lagBot");
function balancedBot(seed) {
  return styleBot(BALANCED, seed);
}
__name(balancedBot, "balancedBot");
function makeBot(name, seed) {
  switch (name) {
    case "fold":
      return checkFoldBot();
    case "call":
      return callBot();
    case "random":
      return randomBot(seed);
    case "aggro":
      return aggroBot(seed);
    case "tight":
      return tightBot(seed);
    case "lag":
      return lagBot(seed);
    case "balanced":
      return balancedBot(seed);
  }
}
__name(makeBot, "makeBot");

// src/util.ts
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
__name(nowIso, "nowIso");
function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(randomHex, "randomHex");
function newId(prefix) {
  return `${prefix}_${randomHex(8)}`;
}
__name(newId, "newId");
function newApiKey() {
  return `pa_${randomHex(24)}`;
}
__name(newApiKey, "newApiKey");
function newSecret() {
  return `sk_${randomHex(24)}`;
}
__name(newSecret, "newSecret");
async function sha256Hex(input) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
async function hmacSha256Hex(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacSha256Hex, "hmacSha256Hex");
function mixSeed(seed, n) {
  let h = (seed ^ Math.imul(n + 1, 2654435769)) >>> 0;
  h = Math.imul(h ^ h >>> 16, 2246822507) >>> 0;
  h = Math.imul(h ^ h >>> 13, 3266489909) >>> 0;
  return (h ^ h >>> 16) >>> 0;
}
__name(mixSeed, "mixSeed");
function computeRating(hands, netChips, sumSqBb, chipsPerBb) {
  if (hands <= 0) return { bb100: 0, ci95: null };
  const meanBb = netChips / chipsPerBb / hands;
  const bb100 = meanBb * 100;
  if (hands < 100) return { bb100, ci95: null };
  const variance = Math.max(0, sumSqBb / hands - meanBb * meanBb);
  const stderr = Math.sqrt(variance / hands);
  return { bb100, ci95: 1.96 * stderr * 100 };
}
__name(computeRating, "computeRating");

// src/agents.ts
var BUILTIN_STRATEGIES = ["fold", "call", "random", "aggro", "tight"];
function isBuiltinStrategy(name) {
  try {
    return typeof makeBot(name, 1) === "function";
  } catch {
    return false;
  }
}
__name(isBuiltinStrategy, "isBuiltinStrategy");
function builtinAgent(strategy, seed) {
  const agent = makeBot(strategy, seed);
  if (typeof agent !== "function") throw new Error(`unknown builtin strategy: ${strategy}`);
  return agent;
}
__name(builtinAgent, "builtinAgent");
function webhookAgent(url, secret, timeoutMs, outcome) {
  return async (req) => {
    const body = JSON.stringify(req);
    let res;
    try {
      const signature = await hmacSha256Hex(secret, body);
      res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-arena-signature": `sha256=${signature}`,
          "x-arena-hand-id": req.hand_id
        },
        body,
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (err) {
      outcome.failures++;
      outcome.lastError = err instanceof Error ? err.message : "request failed";
      throw err;
    }
    if (!res.ok) {
      outcome.failures++;
      outcome.lastError = `HTTP ${res.status}`;
      throw new Error(outcome.lastError);
    }
    let parsed;
    try {
      parsed = await res.json();
    } catch {
      outcome.failures++;
      outcome.lastError = "response was not valid JSON";
      throw new Error(outcome.lastError);
    }
    const action = parsed;
    if (!action || typeof action !== "object" || typeof action.action !== "string") {
      outcome.failures++;
      outcome.lastError = "response had no action field";
      throw new Error(outcome.lastError);
    }
    outcome.failures = 0;
    return action;
  };
}
__name(webhookAgent, "webhookAgent");

// src/store.ts
async function getUserByApiKeyHash(db, hash) {
  return db.prepare("SELECT * FROM users WHERE api_key_hash = ?").bind(hash).first();
}
__name(getUserByApiKeyHash, "getUserByApiKeyHash");
async function getBot(db, id) {
  return db.prepare("SELECT * FROM bots WHERE id = ?").bind(id).first();
}
__name(getBot, "getBot");
async function listBotsByOwner(db, ownerId) {
  const res = await db.prepare("SELECT * FROM bots WHERE owner_id = ? ORDER BY created_at").bind(ownerId).all();
  return res.results ?? [];
}
__name(listBotsByOwner, "listBotsByOwner");
async function listActiveBots(db) {
  const res = await db.prepare("SELECT * FROM bots WHERE status = 'active' ORDER BY created_at").all();
  return res.results ?? [];
}
__name(listActiveBots, "listActiveBots");
async function getStats(db, seasonId, botId, version) {
  return db.prepare("SELECT * FROM season_stats WHERE season_id = ? AND bot_id = ? AND version = ?").bind(seasonId, botId, version).first();
}
__name(getStats, "getStats");

// src/league.ts
var WEBHOOK_TIMEOUT_MS = 5e3;
var AUTO_ERROR_THRESHOLD = 20;
var HAND_RETENTION = 2e4;
function emptyDelta() {
  return {
    hands: 0,
    net: 0,
    sumSqBb: 0,
    vpip: 0,
    pfr: 0,
    showdown: 0,
    wonShowdown: 0,
    btnHands: 0,
    btnNet: 0,
    bbHands: 0,
    bbNet: 0
  };
}
__name(emptyDelta, "emptyDelta");
async function ensureBuiltins(env) {
  const existing = await env.DB.prepare("SELECT COUNT(*) AS n FROM bots WHERE kind = 'builtin'").first();
  if ((existing?.n ?? 0) > 0) return;
  const at = nowIso();
  const systemId = "usr_system";
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (id, name, api_key_hash, created_at) VALUES (?, ?, ?, ?)"
  ).bind(systemId, "arena", `system-${systemId}`, at).run();
  const presets = [
    { name: "house-tight", strategy: "tight" },
    { name: "house-aggro", strategy: "aggro" },
    { name: "house-call", strategy: "call" },
    { name: "house-random", strategy: "random" },
    { name: "house-rock", strategy: "fold" }
  ];
  const stmts = presets.map(
    (p) => env.DB.prepare(
      `INSERT INTO bots (id, owner_id, name, kind, builtin_strategy, secret, status, version, created_at, updated_at)
       VALUES (?, ?, ?, 'builtin', ?, ?, 'active', 1, ?, ?)`
    ).bind(newId("bot"), systemId, p.name, p.strategy, newSecret(), at, at)
  );
  await env.DB.batch(stmts);
}
__name(ensureBuiltins, "ensureBuiltins");
function agentFor(bot, seed, outcome) {
  if (bot.kind === "webhook" && bot.webhook_url) {
    return webhookAgent(bot.webhook_url, bot.secret, WEBHOOK_TIMEOUT_MS, outcome);
  }
  return builtinAgent(bot.builtin_strategy ?? "call", seed);
}
__name(agentFor, "agentFor");
function accumulate(delta, result, seat, isButton2) {
  const seatResult = result.seats[seat];
  if (!seatResult) return;
  const net = seatResult.net;
  const netBb = net / CHIPS_PER_BB;
  delta.hands++;
  delta.net += net;
  delta.sumSqBb += netBb * netBb;
  if (isButton2) {
    delta.btnHands++;
    delta.btnNet += net;
  } else {
    delta.bbHands++;
    delta.bbNet += net;
  }
  const preflop = result.events.filter(
    (e) => e.type === "action" && e.record.seat === seat && e.record.street === "preflop"
  );
  const voluntary = preflop.some(
    (e) => e.type === "action" && ["call", "bet", "raise"].includes(e.record.action)
  );
  const raised = preflop.some((e) => e.type === "action" && e.record.action === "raise");
  if (voluntary) delta.vpip++;
  if (raised) delta.pfr++;
  if (seatResult.showedDown) {
    delta.showdown++;
    if (net > 0) delta.wonShowdown++;
  }
}
__name(accumulate, "accumulate");
function pairKey(a, b) {
  return a < b ? `tbl_${a}_${b}` : `tbl_${b}_${a}`;
}
__name(pairKey, "pairKey");
async function runLeagueBatch(env, season, budgetMs) {
  const started = Date.now();
  const bots = await listActiveBots(env.DB);
  const report = { handsPlayed: 0, pairsPlayed: 0, elapsedMs: 0, deactivated: [] };
  if (bots.length < 2) {
    report.elapsedMs = Date.now() - started;
    return report;
  }
  const deltas = /* @__PURE__ */ new Map();
  const handRows = [];
  const tableUpdates = /* @__PURE__ */ new Map();
  const failures = /* @__PURE__ */ new Map();
  const pairs = [];
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const a = bots[i];
      const b = bots[j];
      if (a.owner_id === b.owner_id && a.owner_id !== "usr_system") continue;
      pairs.push([a, b]);
    }
  }
  const offset = Math.floor(Date.now() / 6e4) % Math.max(1, pairs.length);
  const ordered = [...pairs.slice(offset), ...pairs.slice(0, offset)];
  for (const [a, b] of ordered) {
    if (Date.now() - started > budgetMs) break;
    const hasWebhook = a.kind === "webhook" || b.kind === "webhook";
    const handsThisPair = hasWebhook ? 12 : 120;
    const tableId = pairKey(a.id, b.id);
    const existing = await env.DB.prepare("SELECT hand_number FROM tables WHERE id = ?").bind(tableId).first();
    let handNumber = existing?.hand_number ?? 0;
    const outcomeA = failures.get(a.id) ?? { failures: a.consecutive_failures, lastError: null };
    const outcomeB = failures.get(b.id) ?? { failures: b.consecutive_failures, lastError: null };
    failures.set(a.id, outcomeA);
    failures.set(b.id, outcomeB);
    for (let h = 0; h < handsThisPair; h++) {
      if (Date.now() - started > budgetMs) break;
      handNumber++;
      const button = handNumber % 2;
      const seed = mixSeed(handNumber, Date.now() & 65535);
      const handId = newId("h");
      const config = {
        handId,
        seats: [
          { id: a.id, stack: season.startingStackBb * CHIPS_PER_BB },
          { id: b.id, stack: season.startingStackBb * CHIPS_PER_BB }
        ],
        button,
        smallBlind: season.smallBlind,
        bigBlind: season.bigBlind,
        rake: season.rake,
        seed
      };
      const agents = [agentFor(a, seed, outcomeA), agentFor(b, seed + 1, outcomeB)];
      let result;
      try {
        result = await playHand(config, agents);
      } catch {
        break;
      }
      report.handsPlayed++;
      for (const [idx, bot] of [a, b].entries()) {
        const delta = deltas.get(bot.id) ?? emptyDelta();
        accumulate(delta, result, idx, button === idx);
        deltas.set(bot.id, delta);
      }
      const keep = hasWebhook || handNumber % 10 === 0;
      if (keep) {
        const seats = [a, b].map((bot, idx) => ({
          seat: idx,
          botId: bot.id,
          botName: bot.name,
          ownerName: bot.owner_id === "usr_system" ? "arena" : bot.owner_id,
          startingStack: season.startingStackBb * CHIPS_PER_BB,
          holeCards: result.seats[idx]?.holeCards ?? [],
          net: result.seats[idx]?.net ?? 0,
          showedDown: result.seats[idx]?.showedDown ?? false
        }));
        handRows.push({ id: handId, tableId, handNumber, button, result, seats });
      }
      tableUpdates.set(tableId, { botA: a.id, botB: b.id, handNumber, lastHandId: handId });
    }
    report.pairsPlayed++;
  }
  await persist(env, season, deltas, handRows, tableUpdates, failures, report);
  report.elapsedMs = Date.now() - started;
  return report;
}
__name(runLeagueBatch, "runLeagueBatch");
async function persist(env, season, deltas, handRows, tableUpdates, failures, report) {
  const at = nowIso();
  const stmts = [];
  for (const [botId, d] of deltas) {
    const bot = await env.DB.prepare("SELECT version FROM bots WHERE id = ?").bind(botId).first();
    const version = bot?.version ?? 1;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO season_stats (season_id, bot_id, version, hands, net_chips, sum_sq_bb,
            vpip_hands, pfr_hands, showdown_hands, won_showdown, btn_hands, btn_net, bb_hands, bb_net, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(season_id, bot_id, version) DO UPDATE SET
            hands = hands + excluded.hands,
            net_chips = net_chips + excluded.net_chips,
            sum_sq_bb = sum_sq_bb + excluded.sum_sq_bb,
            vpip_hands = vpip_hands + excluded.vpip_hands,
            pfr_hands = pfr_hands + excluded.pfr_hands,
            showdown_hands = showdown_hands + excluded.showdown_hands,
            won_showdown = won_showdown + excluded.won_showdown,
            btn_hands = btn_hands + excluded.btn_hands,
            btn_net = btn_net + excluded.btn_net,
            bb_hands = bb_hands + excluded.bb_hands,
            bb_net = bb_net + excluded.bb_net,
            updated_at = excluded.updated_at`
      ).bind(
        season.id,
        botId,
        version,
        d.hands,
        d.net,
        d.sumSqBb,
        d.vpip,
        d.pfr,
        d.showdown,
        d.wonShowdown,
        d.btnHands,
        d.btnNet,
        d.bbHands,
        d.bbNet,
        at
      )
    );
  }
  for (const row of handRows) {
    stmts.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO hands
          (id, season_id, table_id, hand_number, played_at, button, small_blind, big_blind, board, pot, rake, seats, actions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        row.id,
        season.id,
        row.tableId,
        row.handNumber,
        at,
        row.button,
        season.smallBlind,
        season.bigBlind,
        JSON.stringify(row.result.board),
        row.result.totalPot,
        row.result.rake,
        JSON.stringify(row.seats),
        JSON.stringify(row.result.events.filter((e) => e.type === "action").map((e) => e.record))
      )
    );
    for (const seat of row.seats) {
      stmts.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO hand_seats (hand_id, bot_id, seat, net, showdown, played_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(row.id, seat.botId, seat.seat, seat.net, seat.showedDown ? 1 : 0, at)
      );
    }
  }
  for (const [tableId, t] of tableUpdates) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO tables (id, season_id, bot_a, bot_b, hand_number, last_hand_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           hand_number = excluded.hand_number,
           last_hand_id = excluded.last_hand_id,
           updated_at = excluded.updated_at`
      ).bind(tableId, season.id, t.botA, t.botB, t.handNumber, t.lastHandId, at)
    );
  }
  for (const [botId, outcome] of failures) {
    if (outcome.failures >= AUTO_ERROR_THRESHOLD) {
      report.deactivated.push(botId);
      stmts.push(
        env.DB.prepare(
          `UPDATE bots SET status = 'error', consecutive_failures = ?, last_error = ?, last_error_at = ?, updated_at = ?
           WHERE id = ? AND kind = 'webhook'`
        ).bind(outcome.failures, outcome.lastError ?? "\u9023\u7D9A\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8", at, at, botId)
      );
    } else {
      stmts.push(
        env.DB.prepare(
          `UPDATE bots SET consecutive_failures = ?, last_error = COALESCE(?, last_error), updated_at = ? WHERE id = ?`
        ).bind(outcome.failures, outcome.lastError, at, botId)
      );
    }
  }
  for (const botId of deltas.keys()) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO stat_timeline (season_id, bot_id, version, hands, bb100, at)
         SELECT season_id, bot_id, version, hands,
                CASE WHEN hands > 0 THEN (net_chips * 1.0 / ? / hands) * 100 ELSE 0 END, ?
         FROM season_stats WHERE season_id = ? AND bot_id = ?`
      ).bind(CHIPS_PER_BB, at, season.id, botId)
    );
  }
  for (let i = 0; i < stmts.length; i += 50) {
    await env.DB.batch(stmts.slice(i, i + 50));
  }
  await env.DB.prepare(
    `DELETE FROM hands WHERE id IN (
       SELECT id FROM hands ORDER BY played_at DESC LIMIT -1 OFFSET ?
     )`
  ).bind(HAND_RETENTION).run();
}
__name(persist, "persist");

// src/play.ts
var HERO_SEAT = 0;
function buttonForHand(handNumber) {
  return (handNumber - 1) % 2;
}
__name(buttonForHand, "buttonForHand");
function positionLabel(seat, button) {
  return seat === button ? "btn" : "bb";
}
__name(positionLabel, "positionLabel");
function streetFromBoard(board) {
  if (board.length >= 5) return "river";
  if (board.length === 4) return "turn";
  if (board.length === 3) return "flop";
  return "preflop";
}
__name(streetFromBoard, "streetFromBoard");
async function runHand(season, seed, handNumber, opponent, heroActions) {
  const handSeed = mixSeed(seed, handNumber);
  let cursor = 0;
  let signalNeed;
  const needPromise = new Promise((resolve) => {
    signalNeed = resolve;
  });
  const heroAgent = /* @__PURE__ */ __name((req) => {
    const recorded = heroActions[cursor];
    if (recorded !== void 0) {
      cursor++;
      return recorded;
    }
    signalNeed(req);
    return new Promise(() => {
    });
  }, "heroAgent");
  const config = {
    handId: `play_${seed}_${handNumber}`,
    seats: [
      { id: "you", stack: season.startingStackBb * CHIPS_PER_BB },
      { id: opponent, stack: season.startingStackBb * CHIPS_PER_BB }
    ],
    button: buttonForHand(handNumber),
    smallBlind: season.smallBlind,
    bigBlind: season.bigBlind,
    rake: season.rake,
    seed: handSeed
  };
  const agents = [heroAgent, builtinAgent(opponent, handSeed)];
  const finished = playHand(config, agents).then(
    (result) => ({ kind: "done", result })
  );
  const needed = needPromise.then((req) => ({ kind: "need", req }));
  return Promise.race([finished, needed]);
}
__name(runHand, "runHand");
function seatsFromRequest(req, button, opponentName) {
  return req.players.map((p) => ({
    seat: p.seat,
    name: p.seat === HERO_SEAT ? "you" : opponentName,
    isHero: p.seat === HERO_SEAT,
    stack: p.stack,
    bet: p.bet,
    status: p.status,
    cards: p.seat === HERO_SEAT ? req.hole_cards : null,
    isButton: p.seat === button,
    position: positionLabel(p.seat, button)
  }));
}
__name(seatsFromRequest, "seatsFromRequest");
function seatsFromResult(result, button, opponentName, startingStack, revealed) {
  return result.seats.map((s) => ({
    seat: s.seat,
    name: s.seat === HERO_SEAT ? "you" : opponentName,
    isHero: s.seat === HERO_SEAT,
    stack: startingStack - s.committed + s.won,
    bet: 0,
    status: s.folded ? "folded" : "active",
    cards: s.seat === HERO_SEAT || revealed.has(s.seat) ? s.holeCards : null,
    isButton: s.seat === button,
    position: positionLabel(s.seat, button)
  }));
}
__name(seatsFromResult, "seatsFromResult");
function resultToHandResult(result, handNumber) {
  const reveals = result.events.filter((e) => e.type === "showdown").map((e) => ({ seat: e.seat, cards: e.cards, category: categoryOf(e.score) }));
  const winners = [
    ...new Set(
      result.events.filter((e) => e.type === "win").map((e) => e.seat)
    )
  ];
  return {
    handId: result.handId,
    board: result.board,
    pot: result.totalPot,
    rake: result.rake,
    heroNet: result.seats[HERO_SEAT]?.net ?? 0,
    winners,
    reveals,
    foldedOut: reveals.length === 0
  };
}
__name(resultToHandResult, "resultToHandResult");
function actionsOf(result) {
  return result.events.filter((e) => e.type === "action").map((e) => e.record);
}
__name(actionsOf, "actionsOf");
async function buildSession(row, season) {
  const heroActions = JSON.parse(row.hero_actions);
  const button = buttonForHand(row.hand_number);
  const startingStack = season.startingStackBb * CHIPS_PER_BB;
  const outcome = await runHand(season, row.seed, row.hand_number, row.opponent, heroActions);
  const base = {
    id: row.id,
    opponentName: row.opponent,
    handNumber: row.hand_number,
    button,
    heroSeat: HERO_SEAT,
    smallBlind: season.smallBlind,
    bigBlind: season.bigBlind
  };
  if (outcome.kind === "need") {
    const req = outcome.req;
    const totals2 = totalsOf(row.total_hands, row.total_net);
    const session2 = {
      ...base,
      handId: req.hand_id,
      street: req.street,
      board: req.board,
      pot: req.pot,
      seats: seatsFromRequest(req, button, row.opponent),
      actions: req.actions,
      legalActions: req.legal_actions,
      toAct: HERO_SEAT,
      phase: "acting",
      lastHand: null,
      totals: totals2
    };
    return { session: session2, pending: req.legal_actions, finished: null };
  }
  const result = outcome.result;
  const last = resultToHandResult(result, row.hand_number);
  const revealed = new Set(last.reveals.map((r) => r.seat));
  const totals = totalsOf(row.total_hands + 1, row.total_net + last.heroNet);
  const session = {
    ...base,
    handId: result.handId,
    street: streetFromBoard(result.board),
    board: result.board,
    pot: result.totalPot,
    seats: seatsFromResult(result, button, row.opponent, startingStack, revealed),
    actions: actionsOf(result),
    legalActions: [],
    toAct: null,
    phase: "hand_over",
    lastHand: last,
    totals
  };
  return { session, pending: null, finished: result };
}
__name(buildSession, "buildSession");
function totalsOf(hands, netChips) {
  return {
    hands,
    heroNet: netChips,
    bb100: hands > 0 ? netChips / CHIPS_PER_BB / hands * 100 : 0
  };
}
__name(totalsOf, "totalsOf");
function validateAction(action, legal) {
  const kind = action.action;
  if (kind === "fold" || kind === "check" || kind === "call") {
    if (!legal.some((l) => l.action === kind)) return { ok: false, reason: `${kind} \u306F\u9078\u3079\u307E\u305B\u3093` };
    return { ok: true, value: { action: kind } };
  }
  if (kind === "raise") {
    const rule = legal.find((l) => l.action === "raise");
    if (!rule || rule.action !== "raise") return { ok: false, reason: "raise \u306F\u9078\u3079\u307E\u305B\u3093" };
    const amount = action.amount;
    if (typeof amount !== "number" || !Number.isInteger(amount)) {
      return { ok: false, reason: "raise \u306B\u306F\u6574\u6570\u306E amount \u304C\u5FC5\u8981\u3067\u3059" };
    }
    if (amount < rule.min || amount > rule.max) {
      return { ok: false, reason: `raise \u306F ${rule.min} \u301C ${rule.max} \u306E\u7BC4\u56F2\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044` };
    }
    return { ok: true, value: { action: "raise", amount } };
  }
  return { ok: false, reason: `\u672A\u77E5\u306E\u30A2\u30AF\u30B7\u30E7\u30F3: ${kind}` };
}
__name(validateAction, "validateAction");

// src/index.ts
var app = new Hono2();
app.use("/api/*", cors());
var fail = /* @__PURE__ */ __name((status, error, message) => Response.json({ error, message }, { status }), "fail");
async function requireUser(c) {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  return getUserByApiKeyHash(c.env.DB, await sha256Hex(token));
}
__name(requireUser, "requireUser");
var auth = /* @__PURE__ */ __name(async (c, next) => {
  const user = await requireUser(c);
  if (!user) return fail(401, "unauthorized", "API \u30AD\u30FC\u304C\u5FC5\u8981\u3067\u3059");
  c.set("userId", user.id);
  c.set("userName", user.name);
  await next();
}, "auth");
app.get("/api/health", async (c) => {
  const season = currentSeason();
  const bots = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM bots").first();
  const tables = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM tables").first();
  const hands = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM hands").first();
  return c.json({ ok: true, season, bots: bots?.n ?? 0, tables: tables?.n ?? 0, hands: hands?.n ?? 0 });
});
app.get("/api/season", (c) => c.json(currentSeason()));
app.get("/api/builtins", (c) => c.json({ strategies: BUILTIN_STRATEGIES }));
function toSummary(row) {
  const hands = row.hands ?? 0;
  const net = row.net_chips ?? 0;
  const { bb100, ci95 } = computeRating(hands, net, row.sum_sq_bb ?? 0, CHIPS_PER_BB);
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    kind: row.kind,
    status: row.status,
    version: row.version,
    hands,
    netChips: net,
    bb100,
    ci95,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
__name(toSummary, "toSummary");
app.get("/api/leaderboard", async (c) => {
  const season = currentSeason();
  const res = await c.env.DB.prepare(
    `SELECT b.*, u.name AS owner_name, s.hands, s.net_chips, s.sum_sq_bb
     FROM bots b
     JOIN users u ON u.id = b.owner_id
     LEFT JOIN season_stats s
       ON s.bot_id = b.id AND s.version = b.version AND s.season_id = ?`
  ).bind(season.id).all();
  const summaries = (res.results ?? []).map(toSummary);
  summaries.sort((a, b) => {
    const aq = a.hands >= season.minHandsForLeaderboard ? 1 : 0;
    const bq = b.hands >= season.minHandsForLeaderboard ? 1 : 0;
    if (aq !== bq) return bq - aq;
    return b.bb100 - a.bb100;
  });
  const entries = summaries.map((s, i) => ({
    ...s,
    rank: i + 1,
    qualified: s.hands >= season.minHandsForLeaderboard
  }));
  const body = {
    season,
    entries,
    totalBots: entries.length,
    updatedAt: nowIso()
  };
  return c.json(body);
});
app.post("/api/signup", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name || name.length > 40) return fail(400, "invalid_request", "name \u306F 1\u301C40 \u6587\u5B57\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
  const apiKey = newApiKey();
  const id = newId("usr");
  await c.env.DB.prepare("INSERT INTO users (id, name, api_key_hash, created_at) VALUES (?, ?, ?, ?)").bind(id, name, await sha256Hex(apiKey), nowIso()).run();
  return c.json({ id, name, apiKey, botLimit: 3 });
});
app.get("/api/me", auth, async (c) => {
  return c.json({ id: c.get("userId"), name: c.get("userName"), botLimit: 3 });
});
async function botToDetail(env, row, ownerName, includePrivate) {
  const season = currentSeason();
  const stats = await getStats(env.DB, season.id, row.id, row.version);
  const summary = toSummary({
    ...row,
    owner_name: ownerName,
    hands: stats?.hands ?? 0,
    net_chips: stats?.net_chips ?? 0,
    sum_sq_bb: stats?.sum_sq_bb ?? 0
  });
  const versionsRes = await env.DB.prepare(
    "SELECT version, hands, net_chips, updated_at FROM season_stats WHERE season_id = ? AND bot_id = ? ORDER BY version DESC"
  ).bind(season.id, row.id).all();
  const detail = {
    ...summary,
    versions: (versionsRes.results ?? []).map((v) => ({
      version: v.version,
      deployedAt: v.updated_at,
      hands: v.hands,
      netChips: v.net_chips,
      bb100: v.hands > 0 ? v.net_chips / CHIPS_PER_BB / v.hands * 100 : 0
    }))
  };
  if (includePrivate) {
    detail.webhookUrl = row.webhook_url ?? void 0;
    detail.builtinStrategy = row.builtin_strategy ?? void 0;
    detail.lastError = row.last_error ? { message: row.last_error, at: row.last_error_at ?? "" } : null;
    const timelineRes = await env.DB.prepare(
      "SELECT hands, bb100 FROM stat_timeline WHERE season_id = ? AND bot_id = ? AND version = ? ORDER BY hands LIMIT 200"
    ).bind(season.id, row.id, row.version).all();
    if (stats) {
      detail.stats = {
        hands: stats.hands,
        bb100: summary.bb100,
        vpip: stats.hands > 0 ? stats.vpip_hands / stats.hands * 100 : 0,
        pfr: stats.hands > 0 ? stats.pfr_hands / stats.hands * 100 : 0,
        wtsd: stats.hands > 0 ? stats.showdown_hands / stats.hands * 100 : 0,
        wonAtShowdown: stats.showdown_hands > 0 ? stats.won_showdown / stats.showdown_hands * 100 : 0,
        byPosition: {
          btn: {
            hands: stats.btn_hands,
            bb100: stats.btn_hands > 0 ? stats.btn_net / CHIPS_PER_BB / stats.btn_hands * 100 : 0
          },
          bb: {
            hands: stats.bb_hands,
            bb100: stats.bb_hands > 0 ? stats.bb_net / CHIPS_PER_BB / stats.bb_hands * 100 : 0
          }
        },
        timeline: timelineRes.results ?? []
      };
    }
  }
  return detail;
}
__name(botToDetail, "botToDetail");
app.get("/api/bots", auth, async (c) => {
  const rows = await listBotsByOwner(c.env.DB, c.get("userId"));
  const season = currentSeason();
  const out = [];
  for (const row of rows) {
    const stats = await getStats(c.env.DB, season.id, row.id, row.version);
    out.push(
      toSummary({
        ...row,
        owner_name: c.get("userName"),
        hands: stats?.hands ?? 0,
        net_chips: stats?.net_chips ?? 0,
        sum_sq_bb: stats?.sum_sq_bb ?? 0
      })
    );
  }
  return c.json(out);
});
app.post("/api/bots", auth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name || name.length > 32 || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    return fail(400, "invalid_request", "name \u306F\u82F1\u6570\u5B57\u30FB\u30CF\u30A4\u30D5\u30F3\u30FB\u30A2\u30F3\u30C0\u30FC\u30B9\u30B3\u30A2 32 \u6587\u5B57\u4EE5\u5185");
  }
  const kind = body.kind === "builtin" ? "builtin" : "webhook";
  if (kind === "webhook") {
    if (!body.webhookUrl || !/^https:\/\//.test(body.webhookUrl)) {
      return fail(400, "invalid_request", "webhookUrl \u306F https:// \u3067\u59CB\u307E\u308B URL \u304C\u5FC5\u8981\u3067\u3059");
    }
  } else if (!body.builtinStrategy || !isBuiltinStrategy(body.builtinStrategy)) {
    return fail(400, "invalid_request", `builtinStrategy \u306F ${BUILTIN_STRATEGIES.join(" / ")} \u306E\u3044\u305A\u308C\u304B`);
  }
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM bots WHERE owner_id = ?").bind(c.get("userId")).first();
  if ((count?.n ?? 0) >= 3) return fail(409, "conflict", "bot \u306F 1 \u30E6\u30FC\u30B6\u30FC 3 \u500B\u307E\u3067\u3067\u3059");
  const dup = await c.env.DB.prepare("SELECT id FROM bots WHERE name = ?").bind(name).first();
  if (dup) return fail(409, "conflict", "\u305D\u306E\u540D\u524D\u306E bot \u306F\u65E2\u306B\u5B58\u5728\u3057\u307E\u3059");
  const id = newId("bot");
  const secret = newSecret();
  const at = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO bots (id, owner_id, name, kind, webhook_url, builtin_strategy, secret, status, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', 1, ?, ?)`
  ).bind(id, c.get("userId"), name, kind, body.webhookUrl ?? null, body.builtinStrategy ?? null, secret, at, at).run();
  const row = await getBot(c.env.DB, id);
  const detail = await botToDetail(c.env, row, c.get("userName"), true);
  return c.json({ ...detail, secret });
});
async function ownedBot(c) {
  const row = await getBot(c.env.DB, c.req.param("id"));
  if (!row) return fail(404, "not_found", "bot \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  if (row.owner_id !== c.get("userId")) return fail(403, "forbidden", "\u81EA\u5206\u306E bot \u3067\u306F\u3042\u308A\u307E\u305B\u3093");
  return row;
}
__name(ownedBot, "ownedBot");
app.get("/api/bots/:id", async (c) => {
  const row = await getBot(c.env.DB, c.req.param("id"));
  if (!row) return fail(404, "not_found", "bot \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  const owner = await c.env.DB.prepare("SELECT name FROM users WHERE id = ?").bind(row.owner_id).first();
  const user = await requireUser(c);
  const mine = user?.id === row.owner_id;
  return c.json(await botToDetail(c.env, row, owner?.name ?? "unknown", mine));
});
app.post("/api/bots/:id/versions", auth, async (c) => {
  const row = await ownedBot(c);
  if (row instanceof Response) return row;
  const body = await c.req.json().catch(() => ({}));
  const at = nowIso();
  await c.env.DB.prepare(
    `UPDATE bots SET version = version + 1, webhook_url = COALESCE(?, webhook_url),
       builtin_strategy = COALESCE(?, builtin_strategy), consecutive_failures = 0,
       last_error = NULL, last_error_at = NULL, updated_at = ? WHERE id = ?`
  ).bind(body.webhookUrl ?? null, body.builtinStrategy ?? null, at, row.id).run();
  const updated = await getBot(c.env.DB, row.id);
  return c.json(await botToDetail(c.env, updated, c.get("userName"), true));
});
for (const [path, status] of [["activate", "active"], ["deactivate", "idle"]]) {
  app.post(`/api/bots/:id/${path}`, auth, async (c) => {
    const row = await ownedBot(c);
    if (row instanceof Response) return row;
    await c.env.DB.prepare(
      "UPDATE bots SET status = ?, consecutive_failures = 0, updated_at = ? WHERE id = ?"
    ).bind(status, nowIso(), row.id).run();
    const updated = await getBot(c.env.DB, row.id);
    return c.json(await botToDetail(c.env, updated, c.get("userName"), true));
  });
}
app.delete("/api/bots/:id", auth, async (c) => {
  const row = await ownedBot(c);
  if (row instanceof Response) return row;
  await c.env.DB.prepare("DELETE FROM bots WHERE id = ?").bind(row.id).run();
  return c.json({ ok: true });
});
app.get("/api/tables", async (c) => {
  const res = await c.env.DB.prepare(
    "SELECT * FROM tables ORDER BY updated_at DESC LIMIT 40"
  ).all();
  const out = [];
  for (const t of res.results ?? []) {
    const names = await c.env.DB.prepare("SELECT id, name FROM bots WHERE id IN (?, ?)").bind(t.bot_a, t.bot_b).all();
    out.push({
      id: t.id,
      format: "hu",
      street: "preflop",
      handNumber: t.hand_number,
      seatedBots: (names.results ?? []).map((n) => n.name),
      occupancy: "2/2"
    });
  }
  return c.json(out);
});
app.get("/api/tables/:id", async (c) => {
  const t = await c.env.DB.prepare("SELECT * FROM tables WHERE id = ?").bind(c.req.param("id")).first();
  if (!t) return fail(404, "not_found", "\u30C6\u30FC\u30D6\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  const hand = t.last_hand_id ? await c.env.DB.prepare("SELECT * FROM hands WHERE id = ?").bind(t.last_hand_id).first() : null;
  if (!hand) return fail(404, "not_found", "\u307E\u3060\u30CF\u30F3\u30C9\u304C\u3042\u308A\u307E\u305B\u3093");
  const seats = JSON.parse(hand.seats);
  const board = JSON.parse(hand.board);
  const view = {
    id: t.id,
    format: "hu",
    handId: hand.id,
    handNumber: hand.hand_number,
    street: board.length >= 5 ? "river" : board.length === 4 ? "turn" : board.length === 3 ? "flop" : "preflop",
    board,
    pot: hand.pot,
    seats: seats.map((s) => ({
      seat: s.seat,
      botId: s.botId,
      botName: s.botName,
      ownerName: s.ownerName,
      stack: s.startingStack + s.net,
      bet: 0,
      status: s.showedDown ? "active" : "folded",
      cards: s.showedDown ? s.holeCards : void 0,
      isButton: s.seat === hand.button,
      toAct: false
    })),
    actions: JSON.parse(hand.actions),
    spectators: 0,
    updatedAt: t.updated_at
  };
  return c.json(view);
});
app.get("/api/hands", auth, async (c) => {
  const botId = c.req.query("botId");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  if (!botId) return fail(400, "invalid_request", "botId \u304C\u5FC5\u8981\u3067\u3059");
  const bot = await getBot(c.env.DB, botId);
  if (!bot) return fail(404, "not_found", "bot \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  if (bot.owner_id !== c.get("userId")) return fail(403, "forbidden", "\u81EA\u5206\u306E bot \u3067\u306F\u3042\u308A\u307E\u305B\u3093");
  const res = await c.env.DB.prepare(
    `SELECT h.*, hs.seat AS my_seat, hs.net AS my_net
     FROM hand_seats hs JOIN hands h ON h.id = hs.hand_id
     WHERE hs.bot_id = ? ORDER BY hs.played_at DESC LIMIT ?`
  ).bind(botId, limit).all();
  const hands = (res.results ?? []).map((h) => {
    const seats = JSON.parse(h.seats);
    const mine = seats.find((s) => s.seat === h.my_seat);
    return {
      handId: h.id,
      tableId: h.table_id,
      playedAt: h.played_at,
      seat: h.my_seat,
      position: h.my_seat === h.button ? "btn" : "bb",
      holeCards: mine?.holeCards ?? [],
      board: JSON.parse(h.board),
      net: h.my_net,
      potSize: h.pot,
      wentToShowdown: seats.some((s) => s.showedDown),
      opponents: seats.filter((s) => s.seat !== h.my_seat).map((s) => ({ seat: s.seat, botName: s.botName }))
    };
  });
  return c.json({ hands, nextCursor: null });
});
app.get("/api/hands/:handId", auth, async (c) => {
  const h = await c.env.DB.prepare("SELECT * FROM hands WHERE id = ?").bind(c.req.param("handId")).first();
  if (!h) return fail(404, "not_found", "\u30CF\u30F3\u30C9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  const seats = JSON.parse(h.seats);
  const mineRow = await c.env.DB.prepare(
    `SELECT hs.seat FROM hand_seats hs JOIN bots b ON b.id = hs.bot_id
     WHERE hs.hand_id = ? AND b.owner_id = ?`
  ).bind(h.id, c.get("userId")).first();
  if (!mineRow) return fail(403, "forbidden", "\u3053\u306E\u30CF\u30F3\u30C9\u306F\u81EA\u5206\u306E bot \u306E\u3082\u306E\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
  const board = JSON.parse(h.board);
  const mine = seats.find((s) => s.seat === mineRow.seat);
  const detail = {
    handId: h.id,
    tableId: h.table_id,
    playedAt: h.played_at,
    seat: mineRow.seat,
    position: mineRow.seat === h.button ? "btn" : "bb",
    holeCards: mine?.holeCards ?? [],
    board,
    net: mine?.net ?? 0,
    potSize: h.pot,
    wentToShowdown: seats.some((s) => s.showedDown),
    opponents: seats.filter((s) => s.seat !== mineRow.seat).map((s) => ({ seat: s.seat, botName: s.botName })),
    seats: seats.map((s) => ({
      seat: s.seat,
      botName: s.botName,
      startingStack: s.startingStack,
      // 自分視点: 相手のカードはショーダウン公開分のみ
      holeCards: s.seat === mineRow.seat || s.showedDown ? s.holeCards : null,
      net: s.net
    })),
    actions: JSON.parse(h.actions),
    streets: [
      { street: "preflop", board: [] },
      { street: "flop", board: board.slice(0, 3) },
      { street: "turn", board: board.slice(0, 4) },
      { street: "river", board: board.slice(0, 5) }
    ].filter((s) => s.street === "preflop" || s.board.length > 0),
    rake: h.rake,
    smallBlind: h.small_blind,
    bigBlind: h.big_blind,
    button: h.button
  };
  return c.json(detail);
});
app.post("/api/test-match", auth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const bot = body.botId ? await getBot(c.env.DB, body.botId) : null;
  if (!bot) return fail(404, "not_found", "bot \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  if (bot.owner_id !== c.get("userId")) return fail(403, "forbidden", "\u81EA\u5206\u306E bot \u3067\u306F\u3042\u308A\u307E\u305B\u3093");
  const opponent = body.opponent ?? "call";
  if (!isBuiltinStrategy(opponent)) return fail(400, "invalid_request", "opponent \u306F\u7D44\u307F\u8FBC\u307F\u6226\u7565\u540D\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
  if (bot.kind === "webhook") return fail(400, "invalid_request", "webhook bot \u306E\u30C6\u30B9\u30C8\u30DE\u30C3\u30C1\u306F\u672A\u5BFE\u5FDC\u3067\u3059");
  const season = currentSeason();
  const seed = body.seed ?? 1;
  const hands = Math.min(Math.max(Number(body.hands ?? 500), 1), 2e3);
  const started = Date.now();
  let netA = 0;
  for (let i = 1; i <= hands; i++) {
    const handSeed = mixSeed(seed, i);
    const config = {
      handId: `test_${seed}_${i}`,
      seats: [
        { id: bot.name, stack: season.startingStackBb * CHIPS_PER_BB },
        { id: opponent, stack: season.startingStackBb * CHIPS_PER_BB }
      ],
      button: buttonForHand(i),
      smallBlind: season.smallBlind,
      bigBlind: season.bigBlind,
      rake: season.rake,
      seed: handSeed
    };
    const agents = [
      builtinAgent(bot.builtin_strategy ?? "call", handSeed),
      builtinAgent(opponent, handSeed + 1)
    ];
    const result = await playHand(config, agents);
    netA += result.seats[0]?.net ?? 0;
  }
  return c.json({
    hands,
    results: [
      { id: bot.name, netChips: netA, bb100: netA / CHIPS_PER_BB / hands * 100 },
      { id: opponent, netChips: -netA, bb100: -netA / CHIPS_PER_BB / hands * 100 }
    ],
    sampleHandIds: [],
    durationMs: Date.now() - started
  });
});
app.post("/api/play", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const opponent = body.opponent ?? "tight";
  if (!isBuiltinStrategy(opponent)) {
    return fail(400, "invalid_request", `opponent \u306F ${BUILTIN_STRATEGIES.join(" / ")} \u306E\u3044\u305A\u308C\u304B`);
  }
  const id = newId("play");
  const at = nowIso();
  const seed = Math.floor(Math.random() * 2 ** 31);
  await c.env.DB.prepare(
    `INSERT INTO play_sessions (id, opponent, seed, hand_number, hero_actions, total_hands, total_net, created_at, updated_at)
     VALUES (?, ?, ?, 1, '[]', 0, 0, ?, ?)`
  ).bind(id, opponent, seed, at, at).run();
  const row = await c.env.DB.prepare("SELECT * FROM play_sessions WHERE id = ?").bind(id).first();
  const { session } = await buildSession(row, currentSeason());
  return c.json(session);
});
async function loadPlay(env, id) {
  const row = await env.DB.prepare("SELECT * FROM play_sessions WHERE id = ?").bind(id).first();
  if (!row) return fail(404, "not_found", "\u30BB\u30C3\u30B7\u30E7\u30F3\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  return row;
}
__name(loadPlay, "loadPlay");
app.get("/api/play/:id", async (c) => {
  const row = await loadPlay(c.env, c.req.param("id"));
  if (row instanceof Response) return row;
  const { session } = await buildSession(row, currentSeason());
  return c.json(session);
});
app.post("/api/play/:id/act", async (c) => {
  const row = await loadPlay(c.env, c.req.param("id"));
  if (row instanceof Response) return row;
  const season = currentSeason();
  const current = await buildSession(row, season);
  if (!current.pending) return fail(409, "conflict", "\u3044\u307E\u306F\u30A2\u30AF\u30B7\u30E7\u30F3\u306E\u624B\u756A\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
  const body = await c.req.json().catch(() => ({}));
  const check = validateAction({ action: body.action ?? "", amount: body.amount }, current.pending);
  if (!check.ok) return fail(400, "invalid_request", check.reason);
  const actions = [...JSON.parse(row.hero_actions), check.value];
  await c.env.DB.prepare("UPDATE play_sessions SET hero_actions = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(actions), nowIso(), row.id).run();
  const { session } = await buildSession({ ...row, hero_actions: JSON.stringify(actions) }, season);
  return c.json(session);
});
app.post("/api/play/:id/next", async (c) => {
  const row = await loadPlay(c.env, c.req.param("id"));
  if (row instanceof Response) return row;
  const season = currentSeason();
  const current = await buildSession(row, season);
  if (!current.finished) return fail(409, "conflict", "\u307E\u3060\u30CF\u30F3\u30C9\u304C\u7D42\u308F\u3063\u3066\u3044\u307E\u305B\u3093");
  const net = current.session.lastHand?.heroNet ?? 0;
  const at = nowIso();
  await c.env.DB.prepare(
    `UPDATE play_sessions SET hand_number = hand_number + 1, hero_actions = '[]',
       total_hands = total_hands + 1, total_net = total_net + ?, updated_at = ? WHERE id = ?`
  ).bind(net, at, row.id).run();
  const updated = await c.env.DB.prepare("SELECT * FROM play_sessions WHERE id = ?").bind(row.id).first();
  const { session } = await buildSession(updated, season);
  return c.json(session);
});
app.all("/api/*", () => fail(404, "not_found", "\u305D\u306E\u30A8\u30F3\u30C9\u30DD\u30A4\u30F3\u30C8\u306F\u3042\u308A\u307E\u305B\u3093"));
var src_default = {
  fetch: app.fetch,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        await ensureBuiltins(env);
        await runLeagueBatch(env, currentSeason(), 2e4);
      })()
    );
  }
};

// ../../node_modules/.pnpm/wrangler@4.124.0_@cloudflare+workers-types@4.20260702.1/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/.pnpm/wrangler@4.124.0_@cloudflare+workers-types@4.20260702.1/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-RlXlyh/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../node_modules/.pnpm/wrangler@4.124.0_@cloudflare+workers-types@4.20260702.1/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-RlXlyh/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
