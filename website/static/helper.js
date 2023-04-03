// wait untill some target is ready
export async function waitTillTargetReady(isTargetReady, milliseconds) {
    while (!isTargetReady()) {
      // wait 1 second before retrying
      await new Promise(resolve => setTimeout(resolve, milliseconds));
    }
  }
  