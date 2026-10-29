import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import type { Classification, VehicleCategory } from '@/lib/listings-api';
import type { Condition, FuelType, ListingFormInput, Transmission } from '@/lib/my-listings-api';

// Same required/optional field set as createListingSchema/updateListingSchema
// (listing-schema.ts) — classifications (>=1) and category are the two
// mandatory enum fields; everything else below price/make/model/year/title
// is optional, matching the server exactly so a submission never fails
// validation for a reason this form didn't already enforce.

const CLASSIFICATIONS: { value: Classification; label: string }[] = [
  { value: 'GROUNDED', label: 'Grounded' },
  { value: 'SALVAGE', label: 'Salvage' },
  { value: 'AUCTION', label: 'Auction' },
  { value: 'OLD_SCHOOL', label: 'Old School' },
];

const CATEGORIES: { value: VehicleCategory; label: string }[] = [
  { value: 'CARS', label: 'Cars' },
  { value: 'SUV_TRUCKS', label: 'SUV & Trucks' },
  { value: 'LORRIES_BUSES', label: 'Lorries and Buses' },
  { value: 'EV_CARS', label: 'Electric Vehicles' },
  { value: 'EV_BIKES', label: 'Electric Bikes' },
];

const TRANSMISSIONS: { value: Transmission; label: string }[] = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'AUTOMATIC', label: 'Automatic' },
  { value: 'CVT', label: 'CVT' },
  { value: 'SEMI_AUTOMATIC', label: 'Semi-automatic' },
];

const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: 'PETROL', label: 'Petrol' },
  { value: 'DIESEL', label: 'Diesel' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ELECTRIC', label: 'Electric' },
  { value: 'LPG', label: 'LPG' },
];

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'BRAND_NEW', label: 'Brand new' },
  { value: 'FOREIGN_USED', label: 'Foreign used' },
  { value: 'LOCALLY_USED', label: 'Locally used' },
];

type FormState = {
  title: string;
  make: string;
  model: string;
  year: string;
  price: string;
  mileage: string;
  transmission: Transmission | undefined;
  fuelType: FuelType | undefined;
  engineSize: string;
  bodyType: string;
  color: string;
  location: string;
  description: string;
  condition: Condition | undefined;
  classifications: Classification[];
  category: VehicleCategory | undefined;
};

function toFormState(initial?: Partial<ListingFormInput>): FormState {
  return {
    title: initial?.title ?? '',
    make: initial?.make ?? '',
    model: initial?.model ?? '',
    year: initial?.year ? String(initial.year) : '',
    price: initial?.price ? String(initial.price) : '',
    mileage: initial?.mileage ? String(initial.mileage) : '',
    transmission: initial?.transmission,
    fuelType: initial?.fuelType,
    engineSize: initial?.engineSize ?? '',
    bodyType: initial?.bodyType ?? '',
    color: initial?.color ?? '',
    location: initial?.location ?? '',
    description: initial?.description ?? '',
    condition: initial?.condition,
    classifications: initial?.classifications ?? [],
    category: initial?.category,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chipRow}>
      {options.map(({ value, label }) => {
        const active = selected.includes(value);
        return (
          <Pressable
            key={value}
            onPress={() => onToggle(value)}
            style={[styles.chip, { borderColor: theme.brand }, active && { backgroundColor: theme.brand }]}
          >
            <ThemedText style={active ? styles.chipTextActive : { color: theme.brand }}>{label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ListingForm({
  initialValues,
  submitLabel,
  submitting,
  error,
  onSubmit,
}: {
  initialValues?: Partial<ListingFormInput>;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: ListingFormInput) => void;
}) {
  const theme = useTheme();
  const [form, setForm] = useState<FormState>(() => toFormState(initialValues));

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleClassification(value: Classification) {
    setForm((prev) => ({
      ...prev,
      classifications: prev.classifications.includes(value)
        ? prev.classifications.filter((c) => c !== value)
        : [...prev.classifications, value],
    }));
  }

  const yearNum = Number(form.year);
  const priceNum = Number(form.price);
  const isValid =
    form.title.trim().length >= 5 &&
    form.make.trim().length > 0 &&
    form.model.trim().length > 0 &&
    Number.isInteger(yearNum) &&
    yearNum > 1900 &&
    priceNum > 0 &&
    form.classifications.length > 0 &&
    Boolean(form.category);

  function handleSubmit() {
    if (!isValid || !form.category) return;
    onSubmit({
      title: form.title.trim(),
      make: form.make.trim(),
      model: form.model.trim(),
      year: yearNum,
      price: priceNum,
      mileage: form.mileage ? Number(form.mileage) : undefined,
      transmission: form.transmission,
      fuelType: form.fuelType,
      engineSize: form.engineSize.trim() || undefined,
      bodyType: form.bodyType.trim() || undefined,
      color: form.color.trim() || undefined,
      location: form.location.trim() || undefined,
      description: form.description.trim() || undefined,
      condition: form.condition,
      classifications: form.classifications,
      category: form.category,
    });
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <View>
      <Field label="Title *">
        <TextInput
          style={inputStyle}
          placeholder="e.g. 2018 Toyota Harrier, clean title"
          placeholderTextColor={theme.textSecondary}
          value={form.title}
          onChangeText={(v) => update('title', v)}
        />
      </Field>

      <View style={styles.row}>
        <View style={styles.half}>
          <Field label="Make *">
            <TextInput style={inputStyle} placeholder="Toyota" placeholderTextColor={theme.textSecondary} value={form.make} onChangeText={(v) => update('make', v)} />
          </Field>
        </View>
        <View style={styles.half}>
          <Field label="Model *">
            <TextInput style={inputStyle} placeholder="Harrier" placeholderTextColor={theme.textSecondary} value={form.model} onChangeText={(v) => update('model', v)} />
          </Field>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Field label="Year *">
            <TextInput style={inputStyle} placeholder="2018" placeholderTextColor={theme.textSecondary} keyboardType="number-pad" value={form.year} onChangeText={(v) => update('year', v)} />
          </Field>
        </View>
        <View style={styles.half}>
          <Field label="Price (KES) *">
            <TextInput style={inputStyle} placeholder="1500000" placeholderTextColor={theme.textSecondary} keyboardType="number-pad" value={form.price} onChangeText={(v) => update('price', v)} />
          </Field>
        </View>
      </View>

      <Field label="Mileage (km)">
        <TextInput style={inputStyle} placeholder="85000" placeholderTextColor={theme.textSecondary} keyboardType="number-pad" value={form.mileage} onChangeText={(v) => update('mileage', v)} />
      </Field>

      <Field label="Category *">
        <ChipGroup options={CATEGORIES} selected={form.category ? [form.category] : []} onToggle={(v) => update('category', v)} />
      </Field>

      <Field label="Classification * (select at least one)">
        <ChipGroup options={CLASSIFICATIONS} selected={form.classifications} onToggle={toggleClassification} />
      </Field>

      <Field label="Transmission">
        <ChipGroup options={TRANSMISSIONS} selected={form.transmission ? [form.transmission] : []} onToggle={(v) => update('transmission', form.transmission === v ? undefined : v)} />
      </Field>

      <Field label="Fuel type">
        <ChipGroup options={FUEL_TYPES} selected={form.fuelType ? [form.fuelType] : []} onToggle={(v) => update('fuelType', form.fuelType === v ? undefined : v)} />
      </Field>

      <Field label="Condition">
        <ChipGroup options={CONDITIONS} selected={form.condition ? [form.condition] : []} onToggle={(v) => update('condition', form.condition === v ? undefined : v)} />
      </Field>

      <View style={styles.row}>
        <View style={styles.half}>
          <Field label="Engine size">
            <TextInput style={inputStyle} placeholder="2000cc" placeholderTextColor={theme.textSecondary} value={form.engineSize} onChangeText={(v) => update('engineSize', v)} />
          </Field>
        </View>
        <View style={styles.half}>
          <Field label="Color">
            <TextInput style={inputStyle} placeholder="White" placeholderTextColor={theme.textSecondary} value={form.color} onChangeText={(v) => update('color', v)} />
          </Field>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Field label="Body type">
            <TextInput style={inputStyle} placeholder="SUV" placeholderTextColor={theme.textSecondary} value={form.bodyType} onChangeText={(v) => update('bodyType', v)} />
          </Field>
        </View>
        <View style={styles.half}>
          <Field label="Location">
            <TextInput style={inputStyle} placeholder="Nairobi" placeholderTextColor={theme.textSecondary} value={form.location} onChangeText={(v) => update('location', v)} />
          </Field>
        </View>
      </View>

      <Field label="Description">
        <TextInput
          style={[inputStyle, styles.textArea]}
          placeholder="Tell buyers more about this vehicle…"
          placeholderTextColor={theme.textSecondary}
          value={form.description}
          onChangeText={(v) => update('description', v)}
          multiline
          numberOfLines={5}
        />
      </Field>

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={[styles.submitButton, { backgroundColor: theme.brand }, (submitting || !isValid) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={submitting || !isValid}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.submitButtonText}>{submitLabel}</ThemedText>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: Spacing.three },
  fieldLabel: { marginBottom: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.three },
  half: { flex: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  chipTextActive: { color: '#fff' },
  error: { color: '#D14343', marginBottom: Spacing.three },
  submitButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
  buttonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
