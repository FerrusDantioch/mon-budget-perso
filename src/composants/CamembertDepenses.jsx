/*
 * GRAPHIQUE CIRCULAIRE DE REPARTITION DES DEPENSES
 *
 * Ce composant est le seul a utiliser la librairie Recharts. Il est charge
 * "a la demande" (voir React.lazy dans TableauDeBord.jsx) : la librairie n'est
 * donc pas telechargee tant que l'utilisateur n'a pas ouvert le tableau de
 * bord, ce qui accelere le tout premier affichage de l'application.
 *
 * Accessibilite : un graphique en SVG n'est pas lisible par un lecteur
 * d'ecran. On le marque donc comme "image decorative avec resume" et on
 * affiche juste en dessous une legende textuelle qui contient exactement les
 * memes informations (WCAG 1.1.1).
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formaterMontant } from '../utils/monnaie.js';

/** Petite bulle affichee au survol (ou a l'appui) d'une part du camembert. */
function Infobulle({ active, payload, devise }) {
  if (!active || !payload || payload.length === 0) return null;
  const part = payload[0].payload;
  return (
    <div className="infobulle-graphique">
      <strong>{part.nom}</strong>
      {formaterMontant(part.valeur, devise)} — {part.part} %
    </div>
  );
}

export default function CamembertDepenses({ donnees, devise, total }) {
  if (donnees.length === 0) {
    return (
      <p className="centre-vide">
        Aucune dépense ce mois-ci : le graphique apparaîtra dès la première
        saisie.
      </p>
    );
  }

  // Resume textuel du graphique, lu par les lecteurs d'ecran.
  const resumeTextuel =
    `Répartition des dépenses : ` +
    donnees.map((d) => `${d.nom} ${d.part} %`).join(', ') +
    `. Total ${formaterMontant(total, devise)}.`;

  return (
    <>
      <div className="zone-graphique" role="img" aria-label={resumeTextuel}>
        {/* ResponsiveContainer adapte le graphique a la largeur de l'ecran. */}
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donnees}
              dataKey="valeur"
              nameKey="nom"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="82%"
              paddingAngle={donnees.length > 1 ? 2 : 0}
              /* Animation courte : sur telephone, une animation longue donne
                 une impression de lenteur. */
              animationDuration={400}
              isAnimationActive
              stroke="none"
            >
              {donnees.map((part) => (
                <Cell key={part.id} fill={part.couleur} />
              ))}
            </Pie>
            <Tooltip content={<Infobulle devise={devise} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legende : c'est elle qui rend le graphique comprehensible sans
          couleurs, et utilisable au clavier / lecteur d'ecran. */}
      <ul className="legende-graphique">
        {donnees.map((part) => (
          <li key={part.id}>
            <span
              className="point"
              style={{ background: part.couleur }}
              aria-hidden="true"
            />
            <span className="nom">{part.nom}</span>
            <span className="valeur">
              {formaterMontant(part.valeur, devise)} ({part.part} %)
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
