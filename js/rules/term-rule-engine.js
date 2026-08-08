function monthsUntilAgeLimit(birthDate, maximumAgeAtEnd, referenceDate) {
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const limit = new Date(
    birth.getFullYear() + Number(maximumAgeAtEnd.years || 0),
    birth.getMonth() + Number(maximumAgeAtEnd.months || 0),
    birth.getDate(),
    12, 0, 0
  );
  let months = (limit.getFullYear() - referenceDate.getFullYear()) * 12 + (limit.getMonth() - referenceDate.getMonth());
  if (limit.getDate() < referenceDate.getDate()) months -= 1;
  return Math.max(0, months);
}

export function calculateMaximumTerm({ birthDate, requestedTerm, termsData, referenceDate = new Date() }) {
  const absoluteMaximum = Number(termsData.absoluteMaximumMonths);
  const preciseAgeMaximum = birthDate
    ? monthsUntilAgeLimit(birthDate, termsData.maximumAgeAtEnd, referenceDate)
    : null;
  const ageMaximum = preciseAgeMaximum == null ? absoluteMaximum : preciseAgeMaximum;
  const requested = Number(requestedTerm) > 0 ? Number(requestedTerm) : absoluteMaximum;
  const allowed = Math.max(0, Math.min(absoluteMaximum, ageMaximum, requested));
  return {
    allowedMonths: allowed,
    absoluteMaximumMonths: absoluteMaximum,
    ageMaximumMonths: ageMaximum,
    approximate: !birthDate,
    notice: birthDate ? null : 'Informe a data de nascimento para calcular o prazo com precisão.'
  };
}
