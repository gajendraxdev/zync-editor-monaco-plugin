import editorWorkerUrl from 'monaco-editor/esm/vs/editor/editor.worker?worker&url';
import cssWorkerUrl from 'monaco-editor/esm/vs/language/css/css.worker?worker&url';
import htmlWorkerUrl from 'monaco-editor/esm/vs/language/html/html.worker?worker&url';
import jsonWorkerUrl from 'monaco-editor/esm/vs/language/json/json.worker?worker&url';
import typeScriptWorkerUrl from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url';

const workers: Readonly<Record<string, string>> = {
  css: cssWorkerUrl,
  handlebars: htmlWorkerUrl,
  html: htmlWorkerUrl,
  javascript: typeScriptWorkerUrl,
  json: jsonWorkerUrl,
  less: cssWorkerUrl,
  razor: htmlWorkerUrl,
  scss: cssWorkerUrl,
  typescript: typeScriptWorkerUrl,
};

const resolveWorkerUrl = (url: string): string => {
  const relative = url.replace(/^\.\//, '');
  return window.__zyncResolveEditorAsset?.(relative) ?? url;
};

const createSandboxedWorker = async (assetUrl: string, label: string): Promise<Worker> => {
  const response = await fetch(assetUrl, {
    credentials: 'omit',
    mode: 'cors',
  });
  if (!response.ok) {
    throw new Error(`Unable to load the ${label || 'editor'} worker (${response.status})`);
  }

  const source = await response.text();
  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    const worker = new Worker(blobUrl, { name: `zedit-${label || 'editor'}` });
    // Let the worker consume the URL before releasing the multi-megabyte source.
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    return worker;
  } catch (error) {
    URL.revokeObjectURL(blobUrl);
    throw error;
  }
};

export const configureWorkers = (): void => {
  self.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string): Promise<Worker> {
      const assetUrl = resolveWorkerUrl(workers[label] ?? editorWorkerUrl);
      return createSandboxedWorker(assetUrl, label);
    },
  };
};
