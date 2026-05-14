"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Headphones,
  LockKeyhole,
  Network,
  PackageCheck,
  RadioTower,
  ShieldCheck,
  Signal,
  Sparkles,
  UsersRound,
  Wifi,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PhoneField,
  SelectField,
  TextareaField,
  TextField,
} from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatUgx } from "@/lib/format";
import { UGANDA_PHONE_COUNTRY_CODE } from "@/lib/uganda-phone";
import type { BundleOffer, ServiceRequestRequest } from "@/types/domain";

const loginRoute = "/auth/login" as Route;
const publicContainerClass = "mx-auto w-[95%]";
const topLinks = [
  { label: "Wholesale data", href: "#product" },
  { label: "Bundle packages", href: "#packages" },
  { label: "Coverage", href: "#coverage" },
  { label: "Onboarding", href: "#request-service" },
];
const navLinks = [
  { label: "Bulk data", href: "#product" },
  { label: "Packages", href: "#packages" },
  { label: "Coverage", href: "#coverage" },
  { label: "Request service", href: "#request-service" },
  { label: "Contact", href: "#contact" },
];
const landingButtonBaseClass =
  "!rounded-full !border-0 font-extrabold shadow-[0_10px_24px_rgba(20,20,20,0.14)] focus-visible:!ring-ink/25";
const landingInkButtonClass = cn(
  landingButtonBaseClass,
  "!bg-ink !text-white hover:!bg-ink/88",
);
const landingLightButtonClass = cn(
  landingButtonBaseClass,
  "!bg-white !text-ink hover:!bg-white/88",
);
const landingYellowButtonClass = cn(
  landingButtonBaseClass,
  "!bg-primary !text-ink hover:!bg-primary/88",
);

const heroStats = [
  { label: "Service model", value: "Bulk data", icon: Network },
  { label: "Provisioning", value: "Fast activation", icon: RadioTower },
  { label: "Payments", value: "MoMo, Airtime, PRN, card", icon: ShieldCheck },
];

const heroSlides = [
  {
    id: "people-connectivity",
    label: "People using MTN mobile data",
    src: "/images/mtn-hero-people-group.jpg",
    objectPosition: "object-center",
  },
  {
    id: "business-connectivity",
    label: "Business connectivity image",
    src: "/images/mtn-hero-business.jpg",
    objectPosition: "object-center",
  },
];

const productCapabilities = [
  {
    title: "Wholesale data allocation",
    description:
      "Buy central bundles and allocate data across primary and secondary MSISDNs.",
    image: "/images/mtn-mobile-network.jpg",
    icon: PackageCheck,
  },
  {
    title: "Account-managed provisioning",
    description:
      "Onboarding, APN validation, secondary-number management, and balance visibility in one flow.",
    image: "/images/mtn-market-mobile.jpg",
    icon: UsersRound,
  },
  {
    title: "Secure business self-service",
    description:
      "MFA, passkeys, sessions, branded receipts, payment status, and customer preferences.",
    image: "/images/Image-Placeholder-1.png",
    icon: LockKeyhole,
  },
];

const coverageProof = [
  "Keep branches, field teams, customer devices, and staff connected from one bulk data account.",
  "Compare clear packages and request onboarding without calling multiple teams.",
  "Track provisioning, payments, and account access from the customer portal after activation.",
];

const journeySteps = [
  {
    title: "Request access",
    description: "Submit business contact details and preferred package.",
  },
  {
    title: "Validate account",
    description: "MTN checks eligibility, APN details, and primary MSISDN.",
  },
  {
    title: "Activate portal",
    description: "Your team receives secure self-service access.",
  },
  {
    title: "Manage usage",
    description: "Buy packages, allocate data, and track payment status.",
  },
];

const fallbackPackages: BundleOffer[] = [
  {
    id: "public-500gb",
    serviceCode: "BDS-500G-30D",
    name: "Wholesale 500 GB",
    volumeTb: 0.5,
    priceUgx: 1250000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "public-1tb",
    serviceCode: "BDS-1T-30D",
    name: "Wholesale 1 TB",
    volumeTb: 1,
    priceUgx: 2300000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "public-2tb",
    serviceCode: "BDS-2T-30D",
    name: "Wholesale 2 TB",
    volumeTb: 2,
    priceUgx: 4300000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: "",
    updatedAt: "",
  },
];

const initialRequest: ServiceRequestRequest = {
  businessName: "",
  contactPerson: "",
  contactEmail: "",
  contactPhone: UGANDA_PHONE_COUNTRY_CODE,
  preferredPackageId: "",
  message: "",
};

function packageVolumeLabel(bundle: BundleOffer) {
  return bundle.volumeTb >= 1
    ? `${bundle.volumeTb.toLocaleString("en-US")} TB`
    : `${bundle.volumeTb * 1000} GB`;
}

export function PublicSite() {
  const bundlesQuery = useQuery({
    queryKey: ["public-bundles"],
    queryFn: api.bundles,
  });
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [serviceRequest, setServiceRequest] =
    useState<ServiceRequestRequest>(initialRequest);
  const visiblePackages = bundlesQuery.data?.length
    ? bundlesQuery.data
    : fallbackPackages;
  const featuredPackage = useMemo(
    () =>
      visiblePackages.find(
        (bundle) => bundle.id === serviceRequest.preferredPackageId,
      ) ?? visiblePackages[0],
    [serviceRequest.preferredPackageId, visiblePackages],
  );
  const requestMutation = useMutation({
    mutationFn: api.submitServiceRequest,
    onSuccess: () => setServiceRequest(initialRequest),
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveHeroSlide((currentSlide) =>
        currentSlide === heroSlides.length - 1 ? 0 : currentSlide + 1,
      );
    }, 6500);

    return () => window.clearInterval(intervalId);
  }, []);

  function updateRequestField<TField extends keyof ServiceRequestRequest>(
    field: TField,
    value: ServiceRequestRequest[TField],
  ) {
    setServiceRequest((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="min-h-screen bg-[#f5f4ef] text-ink">
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="bg-ink text-white">
          <div
            className={cn(
              publicContainerClass,
              "flex items-center justify-between gap-5 py-2.5 text-sm font-semibold uppercase tracking-wide",
            )}
          >
            <div className="flex items-center gap-6">
              {topLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-white/78 transition-colors hover:text-primary"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <span className="hidden text-white/62 md:inline">
              Bulk data wholesale service
            </span>
          </div>
        </div>
        <div className="pt-4">
          <div
            className={cn(
              publicContainerClass,
              "flex min-h-20 items-center justify-between gap-5 rounded-md bg-primary px-5 py-4 text-primary-foreground shadow-[0_14px_34px_rgba(0,0,0,0.14)] sm:px-7",
            )}
          >
            <Link href="/" className="flex min-w-0 items-center gap-5">
              <span className="relative block h-10 w-24 shrink-0">
                <Image
                  src="/logos/mtn-logo-black.svg"
                  alt="MTN"
                  fill
                  sizes="96px"
                  className="object-contain"
                  priority
                />
              </span>
              <span className="hidden text-base font-extrabold uppercase md:block">
                Bulk Data Wholesale
              </span>
            </Link>
            <nav
              className="hidden items-center gap-7 text-base font-bold lg:flex"
              aria-label="Public navigation"
            >
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="transition-colors hover:text-black/62"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <Button
              asChild
              size="sm"
              className={cn("!h-10 px-6 text-base", landingInkButtonClass)}
            >
              <Link href={loginRoute}>
                Sign in
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate flex min-h-[88svh] items-center overflow-hidden bg-primary pb-10 pt-40 text-ink md:pt-44 lg:pt-40">
          <div className="absolute inset-0 -z-20 overflow-hidden">
            <div
              className="flex h-full transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: `translateX(-${activeHeroSlide * 100}%)`,
              }}
            >
              {heroSlides.map((slide, index) => (
                <div
                  key={slide.id}
                  className="relative h-full min-w-full overflow-hidden bg-primary"
                >
                  {slide.id === "people-connectivity" ? (
                    <div className="absolute inset-y-0 right-0 w-full opacity-50 md:w-[57%] md:opacity-100">
                      <Image
                        src={slide.src}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 57vw, 100vw"
                        className="object-cover object-center"
                        priority={index === 0}
                      />
                    </div>
                  ) : (
                    <Image
                      src={slide.src}
                      alt=""
                      fill
                      sizes="100vw"
                      className={cn("object-cover", slide.objectPosition)}
                      priority={index === 0}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(255,203,5,0.96)_0%,rgba(255,203,5,0.82)_34%,rgba(255,203,5,0.18)_54%,rgba(20,20,20,0.16)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-1/4 bg-[linear-gradient(180deg,rgba(20,20,20,0)_0%,rgba(20,20,20,0.26)_100%)]" />

          <div
            className={cn(
              publicContainerClass,
              "py-12 md:py-16 lg:py-20",
            )}
          >
            <div className="max-w-[47rem]">
              <h1 className="max-w-3xl text-5xl font-extrabold leading-none tracking-normal text-ink sm:text-6xl lg:text-7xl">
                Bulk data built for teams that keep Uganda moving.
              </h1>
              <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-ink/78">
                Buy, allocate, and manage high-volume data for branches,
                devices, field teams, and secondary numbers on MTN-backed
                connectivity.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className={cn("min-w-44", landingInkButtonClass)}
                >
                  <a href="#request-service">
                    Request service
                    <ArrowRight data-icon="inline-end" />
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className={cn("min-w-36", landingLightButtonClass)}
                >
                  <Link href={loginRoute}>Sign in</Link>
                </Button>
              </div>
              <div
                className="mt-8 flex items-center gap-3"
                aria-label="Hero image selection"
              >
                {heroSlides.map((slide, index) => {
                  const selected = activeHeroSlide === index;

                  return (
                    <button
                      key={slide.id}
                      type="button"
                      aria-label={`Show ${slide.label}`}
                      aria-current={selected ? "true" : undefined}
                      className={cn(
                        "h-2 w-10 rounded-full bg-ink/32 transition-all hover:bg-ink/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-primary",
                        selected && "w-16 bg-ink",
                      )}
                      onClick={() => setActiveHeroSlide(index)}
                    />
                  );
                })}
              </div>

              <div className="mt-7 grid max-w-xl gap-2 sm:grid-cols-3">
                {heroStats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <div
                      key={stat.label}
                      className="min-w-0 rounded-md border border-white/45 bg-white/24 p-3 text-ink shadow-[0_16px_36px_rgba(20,20,20,0.12)] backdrop-blur-md"
                    >
                      <Icon className="size-5 text-ink/78" />
                      <p className="mt-3 text-[0.68rem] font-extrabold uppercase text-ink/58">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-base font-extrabold leading-tight text-ink">
                        {stat.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="bg-white py-16">
          <div
            className={cn(
              publicContainerClass,
              "grid gap-10 lg:grid-cols-[0.76fr_1.24fr] lg:items-start",
            )}
          >
            <div>
              <p className="text-sm font-extrabold uppercase text-muted-foreground">
                Bulk data service
              </p>
              <h2 className="mt-3 max-w-xl text-4xl font-extrabold leading-tight">
                Buy bulk data for every branch, team, and device.
              </h2>
              <p className="mt-4 max-w-xl text-base font-medium leading-7 text-muted-foreground">
                Choose a package, share your business details, and MTN will help
                activate data for primary and secondary numbers across your
                organization.
              </p>
              <div className="mt-8 grid gap-3">
                {coverageProof.map((item) => (
                  <div
                    key={item}
                    className="flex gap-3 rounded-md border border-black/8 bg-[#f7f7f2] p-4 text-sm font-semibold leading-6 text-ink/78"
                  >
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-forest" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {productCapabilities.map((item) => {
                const Icon = item.icon;

                return (
                  <Panel
                    key={item.title}
                    className="overflow-hidden border-black/8 p-0 shadow-[0_22px_48px_rgba(20,20,20,0.08)]"
                  >
                    <div className="relative h-56 overflow-hidden lg:h-60">
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 30vw, 95vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="grid size-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                          <Icon />
                        </div>
                        <h3 className="min-w-0 text-xl font-extrabold leading-tight">
                          {item.title}
                        </h3>
                      </div>
                      <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </Panel>
                );
              })}
            </div>
          </div>
        </section>

        <section id="packages" className="bg-primary py-16">
          <div className={cn(publicContainerClass, "flex flex-col gap-8")}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-sm font-extrabold uppercase text-ink/60">
                  Top deals
                </p>
                <h2 className="mt-2 text-4xl font-extrabold leading-tight">
                  Wholesale packages ready for business use.
                </h2>
                <p className="mt-3 max-w-2xl font-semibold leading-7 text-ink/72">
                  Public package information comes from the same catalog used by
                  the customer purchase flow.
                </p>
              </div>
              {bundlesQuery.isFetching && (
                <StatusBadge label="Refreshing catalog" tone="blue" />
              )}
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
              {visiblePackages.map((bundle) => {
                const selected =
                  serviceRequest.preferredPackageId === bundle.id;

                return (
                  <Panel
                    key={bundle.id}
                    className="flex min-h-64 flex-col border-black/10 bg-white p-4 shadow-[0_18px_38px_rgba(20,20,20,0.11)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-extrabold leading-tight text-ink">
                          {bundle.name}
                        </h3>
                      </div>
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-ink">
                        <Wifi className="size-5" />
                      </span>
                    </div>
                    <p className="mt-6 text-4xl font-extrabold leading-none text-ink">
                      {packageVolumeLabel(bundle)}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-ink/62">
                      {bundle.validityDays} days validity
                    </p>
                    <p className="mt-4 text-xl font-extrabold text-ink">
                      {formatUgx(bundle.priceUgx)}
                    </p>
                    <Button
                      type="button"
                      className={cn(
                        "mt-auto",
                        selected ? landingYellowButtonClass : landingInkButtonClass,
                      )}
                      onClick={() => {
                        updateRequestField("preferredPackageId", bundle.id);
                        document
                          .getElementById("request-service")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      {selected ? "Selected package" : "Request this package"}
                    </Button>
                  </Panel>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="coverage"
          className="relative isolate overflow-hidden bg-ink py-16 text-white"
        >
          <Image
            src="/images/mtn-light-trails.jpg"
            alt=""
            fill
            sizes="100vw"
            className="absolute inset-0 -z-20 object-cover object-[58%_50%] opacity-86"
          />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(20,20,20,0.96)_0%,rgba(20,20,20,0.88)_48%,rgba(20,20,20,0.58)_100%)]" />
          <div
            className={cn(
              publicContainerClass,
              "grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-start",
            )}
          >
            <div>
              <p className="text-sm font-extrabold uppercase text-primary">
                Coverage and control
              </p>
              <h2 className="mt-3 max-w-xl text-4xl font-extrabold leading-tight">
                Built for high-volume data operations.
              </h2>
              <p className="mt-4 max-w-xl font-medium leading-7 text-white/72">
                The page now gives business buyers a direct MTN-style path:
                understand the offer, compare packages, and request service
                without digging through a generic landing page.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {journeySteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-md border border-white/14 bg-white/10 p-4 backdrop-blur-md"
                >
                  <span className="grid size-9 place-items-center rounded-md bg-primary font-extrabold text-ink">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-lg font-extrabold leading-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-white/68">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="request-service"
          className="relative isolate overflow-hidden bg-primary py-16 text-ink"
        >
          <div className="absolute inset-0 -z-10 bg-[url('/auth/yellow-banner.jpg')] bg-cover bg-center" />
          <div
            className={cn(
              publicContainerClass,
              "grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start",
            )}
          >
            <div>
              <p className="text-sm font-extrabold uppercase text-ink/60">
                Request service
              </p>
              <h2 className="mt-3 max-w-xl text-4xl font-extrabold leading-tight">
                Tell us where your team needs bulk data.
              </h2>
              <p className="mt-4 max-w-xl font-semibold leading-7 text-ink/70">
                Share your business contact details and preferred package. MTN
                can use the request to open an account registration workflow.
              </p>
              <div className="mt-8 grid gap-3">
                {[
                  "Dedicated business onboarding",
                  "APN and primary MSISDN validation",
                  "Customer portal access after activation",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-sm font-extrabold text-ink/78"
                  >
                    <CheckCircle2 className="size-5 text-forest" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <form
              className="grid gap-4 rounded-md border border-black/10 bg-white p-4 text-foreground shadow-[0_24px_70px_rgba(20,20,20,0.16)] sm:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                requestMutation.mutate(serviceRequest);
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Business name"
                  required
                  value={serviceRequest.businessName}
                  onValueChange={(value) =>
                    updateRequestField("businessName", value)
                  }
                />
                <TextField
                  label="Contact person"
                  required
                  value={serviceRequest.contactPerson}
                  onValueChange={(value) =>
                    updateRequestField("contactPerson", value)
                  }
                />
                <TextField
                  label="Email"
                  required
                  type="email"
                  value={serviceRequest.contactEmail}
                  onValueChange={(value) =>
                    updateRequestField("contactEmail", value)
                  }
                />
                <PhoneField
                  label="Phone"
                  required
                  value={serviceRequest.contactPhone}
                  onValueChange={(value) =>
                    updateRequestField("contactPhone", value)
                  }
                />
              </div>
              <SelectField
                label="Preferred package"
                value={serviceRequest.preferredPackageId ?? ""}
                onValueChange={(value) =>
                  updateRequestField("preferredPackageId", value)
                }
                options={[
                  { label: "Not sure yet", value: "" },
                  ...visiblePackages.map((bundle) => ({
                    label: `${bundle.name} - ${formatUgx(bundle.priceUgx)}`,
                    value: bundle.id,
                  })),
                ]}
              />
              <TextareaField
                label="Message"
                value={serviceRequest.message ?? ""}
                placeholder="Tell us about expected number of users, sites, or primary MSISDNs."
                onValueChange={(value) => updateRequestField("message", value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-muted-foreground">
                  {featuredPackage
                    ? `Selected: ${featuredPackage.name}`
                    : "A service specialist will recommend a package."}
                </p>
                <Button
                  type="submit"
                  disabled={requestMutation.isPending}
                  className={landingInkButtonClass}
                >
                  {requestMutation.isPending
                    ? "Submitting..."
                    : "Submit request"}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
              {requestMutation.isSuccess && (
                <p className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
                  Request submitted. MTN can now contact the business contact
                  for onboarding.
                </p>
              )}
              {requestMutation.isError && (
                <p className="rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-900">
                  {requestMutation.error.message}
                </p>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer id="contact" className="bg-ink py-10 text-white">
        <div
          className={cn(
            publicContainerClass,
            "grid gap-6 md:grid-cols-[1fr_auto] md:items-center",
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-20 shrink-0 place-items-center rounded-md bg-primary px-3 py-2">
                <span className="relative block h-7 w-14">
                  <Image
                    src="/logos/mtn-logo-black.svg"
                    alt="MTN"
                    fill
                    sizes="56px"
                    className="object-contain"
                  />
                </span>
              </span>
              <span className="font-extrabold">
                Bulk Data Wholesale Service
              </span>
            </div>
            <p className="max-w-2xl text-sm font-medium leading-6 text-white/62">
              Packages, customer portal, account security, payment status,
              reports, and account preferences for wholesale data teams.
            </p>
          </div>
          <div className="grid gap-2 text-sm font-semibold sm:grid-cols-2">
            <span className="flex items-center gap-2">
              <Headphones className="size-4 text-primary" />
              0771 001 000
            </span>
            <span className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Plot 69-71 Jinja Road
            </span>
            <span className="flex items-center gap-2">
              <Signal className="size-4 text-primary" />
              Toll free 100
            </span>
            <span className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              customerservice.ug@mtn.com
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
