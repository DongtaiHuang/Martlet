import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun, type LucideProps } from "lucide-react";
import { describeWeather } from "@/lib/weather";

/** Decorative icon for a WMO code; the label is always shown or read next to it. */
export function WeatherIcon({ code, isDay = true, ...props }: { code: number; isDay?: boolean } & LucideProps) {
  const { kind } = describeWeather(code);
  const Icon = {
    clear: isDay ? Sun : Moon,
    partly: isDay ? CloudSun : CloudMoon,
    cloudy: Cloud,
    fog: CloudFog,
    drizzle: CloudDrizzle,
    rain: CloudRain,
    snow: CloudSnow,
    storm: CloudLightning,
  }[kind];
  return <Icon aria-hidden="true" {...props} />;
}
