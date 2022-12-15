import { useEffect, useState } from "react";
import styles from "styles/app.module.scss";
import { ipcRenderer } from "electron";
import { renderToStaticMarkup } from "react-dom/server";

const App: React.FC = () => {
  const [printers, setPrinters] = useState<any[]>([]);

  useEffect(() => {
    ipcRenderer.on("printers-list", (event, props) => {
      console.log(props);
      setPrinters(props);
    });
  }, []);

  return (
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <div className={styles.logos}>
          <div className={styles.imgBox}>
            <img
              src="./electron.png"
              style={{ height: "24vw" }}
              className={styles.appLogo}
              alt="electron"
            />
          </div>
          <div className={styles.imgBox}>
            <img src="./vite.svg" style={{ height: "19vw" }} alt="vite" />
          </div>
          <div className={styles.imgBox}>
            <img
              src="./react.svg"
              style={{ maxWidth: "100%" }}
              className={styles.appLogo}
              alt="logo"
            />
          </div>
        </div>
        <h1>Teste de impressão SEM QZ TRAY</h1>

        <div style={{ display: "flex", gap: "24px" }}>
          <button onClick={() => ipcRenderer.send("get-printers")}>
            Lista de impressoras
          </button>
          <button onClick={() => ipcRenderer.send("print-order")}>
            Imprimir
          </button>
        </div>
        <div>
          {printers.map((printer) => (
            <p key={printer.name}>{printer.displayName}</p>
          ))}
        </div>
      </header>
    </div>
  );
};

export default App;

console.log(renderToStaticMarkup(<App />));
