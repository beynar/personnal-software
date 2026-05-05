import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/products")({
	staticData: {
		dashboardHeader: {
			description: "Rechercher, filtrer et ouvrir les produits du showroom",
			title: "Produits",
		},
	},
	component: ProductsLayout,
});

function ProductsLayout() {
	return <Outlet />;
}
