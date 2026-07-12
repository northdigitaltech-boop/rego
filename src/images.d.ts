declare module "*.PNG" {
  import { StaticImageData } from "next/image";
  const content: StaticImageData;
  export default content;
}
