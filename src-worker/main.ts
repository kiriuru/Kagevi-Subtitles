import { initLoopbackApiToken } from "../src/lib/loopback-api";
import WorkerApp from "./WorkerApp.svelte";
import WorkerAppCompact from "./WorkerAppCompact.svelte";
import { createWorkerUiStore } from "./lib/stores/worker-ui.svelte";
import { createWorkerController } from "./lib/worker/worker-controller";
import { mount } from "svelte";

function isCompactWorkerPath(): boolean {
  return window.location.pathname.includes("/google-asr-compact");
}

async function boot(): Promise<void> {
  await initLoopbackApiToken();

  const target = document.getElementById("app");
  if (!target) {
    throw new Error("Worker mount target #app not found");
  }

  const ui = createWorkerUiStore();
  const controller = createWorkerController(ui);
  const App = isCompactWorkerPath() ? WorkerAppCompact : WorkerApp;

  mount(App, {
    target,
    props: {
      ui,
      actions: controller.actions,
    },
  });
}

void boot();
