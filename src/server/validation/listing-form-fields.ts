// Turns the Add New Car form's raw text fields into the createListingSchema
// input — the same conversion as parseListingFormData in
// listing-actions.ts (empty → undefined, numbers parsed), for the fast
// submit route, which receives the fields as JSON rather than FormData.
export function parseListingFields(fields: Record<string, unknown>) {
  const str = (key: string): string | undefined => {
    const v = fields[key];
    return v === null || v === undefined || v === "" ? undefined : String(v);
  };
  const num = (key: string): number | undefined => {
    const v = fields[key];
    if (v === null || v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  };

  return {
    title: str("title") ?? "",
    make: str("make") ?? "",
    model: str("model") ?? "",
    year: num("year") ?? 0,
    price: num("price") ?? 0,
    currency: str("currency") ?? "KES",
    mileage: num("mileage"),
    transmission: str("transmission"),
    fuelType: str("fuelType"),
    engineSize: str("engineSize"),
    bodyType: str("bodyType"),
    color: str("color"),
    location: str("location"),
    description: str("description"),
    condition: str("condition"),
    importStatus: str("importStatus"),
    category: str("category"),
  };
}
