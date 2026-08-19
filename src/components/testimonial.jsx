import * as React from "react";
import { cn } from "../lib/utils";

function initials(name) {
  if (!name) return "";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function Stars({ count }) {
  return (
    <div className="testimonial-stars" aria-label={`${count} von 5 Sternen`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          fill={i < count ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.5}
          className={cn(
            "testimonial-star",
            i < count ? "testimonial-star--active" : "testimonial-star--inactive"
          )}
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// TestimonialCard
export function TestimonialCard({
  testimonial,
  className,
  ...props
}) {
  const { quote, author, role, company, avatarUrl, rating } = testimonial;

  return (
    <blockquote
      data-slot="testimonial-card"
      className={cn("testimonial-card", className)}
      {...props}
    >
      <div className="testimonial-card-body">
        <div className="testimonial-card-header">
          {rating ? <Stars count={rating} /> : null}
          {company && (
            <span className="testimonial-company-badge">{company}</span>
          )}
        </div>
        <p className="testimonial-quote">{quote}</p>
        <footer className="testimonial-footer">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={44}
              height={44}
              className="testimonial-avatar"
              loading="lazy"
            />
          ) : (
            <span className="testimonial-avatar-fallback">
              {initials(author)}
            </span>
          )}
          <div className="testimonial-author-meta">
            <strong className="testimonial-author-name">{author}</strong>
            {role && (
              <span className="testimonial-author-role">{role}</span>
            )}
          </div>
        </footer>
      </div>
    </blockquote>
  );
}

// TestimonialGrid
const columnClasses = {
  1: "testimonial-grid--1",
  2: "testimonial-grid--2",
  3: "testimonial-grid--3",
};

export function TestimonialGrid({
  testimonials,
  columns = 2,
  title,
  className,
  ...props
}) {
  return (
    <div
      data-slot="testimonial-grid"
      className={cn("testimonial-grid-wrapper", className)}
      {...props}
    >
      {title && (
        <p className="testimonial-section-title">{title}</p>
      )}
      <div className={cn("testimonial-grid", columnClasses[columns])}>
        {testimonials.map((testimonial, i) => (
          <TestimonialCard
            key={`${testimonial.author}-${i}`}
            testimonial={testimonial}
          />
        ))}
      </div>
    </div>
  );
}

// TestimonialMarquee
export function TestimonialMarquee({
  testimonials,
  title,
  duration = 36,
  speed,
  pauseOnHover = true,
  direction = "left",
  className,
  ...props
}) {
  const resolvedDuration = speed ? 36 / speed : duration;

  return (
    <div
      data-slot="testimonial-marquee"
      className={cn("testimonial-marquee-container", className)}
      {...props}
    >
      {title && (
        <p className="testimonial-section-title">{title}</p>
      )}
      <div
        className={cn(
          "testimonial-marquee-track",
          pauseOnHover && "testimonial-marquee-track--pause"
        )}
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="testimonial-marquee-strip"
            style={{
              animationDuration: `${resolvedDuration}s`,
              animationDirection: direction === "right" ? "reverse" : "normal",
            }}
            aria-hidden={copy === 1 ? "true" : undefined}
          >
            {testimonials.map((testimonial, i) => (
              <TestimonialCard
                key={`${testimonial.author}-${copy}-${i}`}
                testimonial={testimonial}
                className="testimonial-marquee-card"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
