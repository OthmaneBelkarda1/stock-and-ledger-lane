import { useEffect } from "react";
import { useErp } from "./store";
import { useSession } from "./session";

let started = false;

/** Charge les données de démonstration (localStorage) puis restaure la session, côté navigateur uniquement. */
export function useBootstrap() {
  const hydrated = useErp((s) => s.hydrated);
  const ready = useSession((s) => s.ready);
  useEffect(() => {
    if (!started) {
      started = true;
      void useErp.persist.rehydrate();
    }
  }, []);
  useEffect(() => {
    if (hydrated && !ready) useSession.getState().init();
  }, [hydrated, ready]);
  return hydrated && ready;
}
