import React from 'react';

interface TaxSectionCardProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const TaxSectionCard: React.FC<TaxSectionCardProps> = ({ title, children, actions }) => (
  <section className="tax-section-card">
    <header className="tax-section-card__header">
      <h3>{title}</h3>
      {actions}
    </header>
    <div>{children}</div>
  </section>
);

export default TaxSectionCard;
