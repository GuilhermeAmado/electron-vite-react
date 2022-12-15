// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, "../..");
process.env.DIST = join(process.env.DIST_ELECTRON, "../dist");
process.env.PUBLIC = app.isPackaged
  ? process.env.DIST
  : join(process.env.DIST_ELECTRON, "../public");

import { app, BrowserWindow, shell, ipcMain } from "electron";
import { release } from "os";
import { join } from "path";
import {
  PosPrinter,
  PosPrintData,
  PosPrintOptions,
} from "electron-pos-printer";
import {
  printer as ThermalPrinter,
  types as PrinterTypes,
} from "node-thermal-printer";

import USB from "@node-escpos/usb-adapter";
import { Image, Printer } from "@node-escpos/core";
import {
  getDefaultPrinterName,
  printDirect,
  getSupportedJobCommands,
  getPrinter,
} from "@thiagoelg/node-printer";
import { printTest } from "../lib/printer";

// Disable GPU Acceleration for Windows 7
if (release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win: BrowserWindow | null = null;
// Here, you can also use other preload
const preload = join(__dirname, "../preload/index.js");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, "index.html");

async function createWindow() {
  win = new BrowserWindow({
    title: "Main window",
    icon: join(process.env.PUBLIC, "favicon.svg"),
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    // electron-vite-vue#298
    win.loadURL(url);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// new window example arg: new windows url
ipcMain.handle("open-win", (event, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});

const options: PosPrintOptions = {
  // preview: true,
  margin: "0",
  copies: 1,
  printerName: "MP-4200 TH",
  // printerName: "Thermal Printer POS58",
  // printerName: "Microsoft Print to PDF",
  timeOutPerLine: 400,
  pageSize: "76mm", // page size:
  silent: true,
  boolean: false,
};

const data: PosPrintData[] = [
  {
    type: "text", // 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
    value: "Endereço",
    style: {
      textDecoration: "bold",
      fontSize: "28px",
      textAlign: "center",
      color: "black",
      fontFamily: "Operator Mono",
      textTransform: "uppercase",
    },
  },
  {
    type: "text",
    value: `<ol><li>1</li><li>2</li><li>3</li></ol>`,
    style: {
      textAlign: "left",
    },
  },
  {
    type: "text",
    value: `<div style="font-size:16px; display:flex; justify-content:space-between; margin: 0px 10px 0px"><div>Pizza</div><div>R$ 34,90</div></div>`,
    style: {
      textAlign: "left",
    },
  },
  {
    type: "table",
    // style the table
    style: { border: "1px solid #000", color: "black" },
    // list of the columns to be rendered in the table header
    tableHeader: ["Itens do pedido", "Valor"],
    // multi dimensional array depicting the rows and columns of the table body
    tableBody: [
      [
        {
          type: "text",
          value: "Hamburger",
          style: {
            fontWeight: "700",
          },
        },
        {
          type: "text",
          value: "R$ 19,90",
        },
      ],
    ],
    // list of columns to be rendered in the table footer
    // tableFooter: ["Animal", "Age"],
    // custom style for the table header
    tableHeaderStyle: { color: "black" },
    // custom style for the table body
    tableBodyStyle: { border: "0.5px solid #000" },
    // custom style for the table footer
    tableFooterStyle: { color: "black" },
  },
];

ipcMain.on("print-order", async (event, args) => {
  const printers = await win.webContents.getPrintersAsync();
  console.log("event received");
  console.log(printers);
  PosPrinter.print(data, options)
    .then(console.log)
    .catch((error) => {
      console.error(error);
    });
});

let printer = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: "printer:MP-4200 TH",
  // interface: "printer:Thermal Printer POS58",
  characterSet: "ISO8859_2_LATIN2",
  removeSpecialCharacters: false,
  lineCharacter: "=",
  width: 32,
  options: {
    timeout: 5000,
  },
  driver: require("@thiagoelg/node-printer"),
});

ipcMain.on("get-printers", async (event, args) => {
  // const printername = getDefaultPrinterName();
  // printDirect({
  //   data: "hello world/n",
  //   printer: printername,
  //   type: "RAW",
  //   success: (jobID) => console.log("sucesso", jobID),
  //   error: (err) => console.log(err),
  // });
  // console.log(printername);
  // console.log(getSupportedJobCommands());
  // console.log(getPrinter("Thermal Printer POS58"));

  const printers = await win.webContents.getPrintersAsync();
  console.log("event received");
  console.log(printers);
  event.reply("printers-list", printers);
});

ipcMain.on("check-install", async (event, args) => {
  printTest(printer);
});
