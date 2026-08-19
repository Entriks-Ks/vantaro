import { cn } from "../lib/utils";

export function SectorProfileCard({ profile, className, ...props }) {
  const Icon = profile.icon;

  return (
    <article className={cn("reference-mini", className)} {...props}>
      <div className="reference-mini-top">
        <span className="mini-icon">
          <Icon size={15} />
        </span>
        <span className="mini-label">{profile.label}</span>
      </div>
      <h4>{profile.title}</h4>
      <p>{profile.description}</p>
    </article>
  );
}

export function SectorProfileMarquee({
  profiles,
  duration = 40,
  speed,
  pauseOnHover = true,
  direction = "right",
  className,
  ...props
}) {
  const resolvedDuration = speed ? 40 / speed : duration;

  return (
    <div
      className={cn("profile-marquee-container", className)}
      {...props}
    >
      <div
        className={cn(
          "profile-marquee-track",
          pauseOnHover && "profile-marquee-track--pause"
        )}
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="profile-marquee-strip"
            style={{
              animationDuration: `${resolvedDuration}s`,
              animationDirection: direction === "right" ? "reverse" : "normal",
            }}
            aria-hidden={copy === 1 ? "true" : undefined}
          >
            {profiles.map((profile, i) => (
              <SectorProfileCard
                key={`${profile.title}-${copy}-${i}`}
                profile={profile}
                className="profile-marquee-card"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
