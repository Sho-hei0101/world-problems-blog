"use client";

import { useState } from "react";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      setStatus("error");
      setMessage("Please enter an email address.");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });
      if (!response.ok) {
        throw new Error("Subscription failed");
      }
      setStatus("success");
      setMessage("Thanks! You are on the list.");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="newsletter">
      <div>
        <p className="newsletter-title">Get the weekly 5-minute brief</p>
        <p className="newsletter-subtitle">Actionable insights and the latest posts, delivered weekly.</p>
      </div>
      <form className="newsletter-form" onSubmit={handleSubmit}>
        <label className="newsletter-label" htmlFor="newsletter-email">
          Email
        </label>
        <div className="newsletter-row">
          <input
            id="newsletter-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={status === "loading" || status === "success"}
            required
          />
          <button type="submit" disabled={status === "loading" || status === "success"}>
            {status === "loading" ? "Submitting..." : "Sign up"}
          </button>
        </div>
        {message && (
          <p
            className={`newsletter-message ${status === "success" ? "is-success" : "is-error"}`}
            role="status"
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
