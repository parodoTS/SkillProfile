import { MyStack } from "./MyStack";
import { App } from "@serverless-stack/resources";

export default function (app: App) {
  app.setDefaultFunctionProps({
    runtime: "python3.8",
  });
  app.setDefaultRemovalPolicy("destroy");
  app.stack(MyStack);
}
