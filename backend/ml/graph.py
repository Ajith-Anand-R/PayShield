import networkx as nx

class GraphIntelligence:
    def __init__(self):
        self.graph = nx.Graph()
        self._seed_data()

    def _seed_data(self):
        # Sample Users, Devices, and Connections
        # User 1 (Good Guy)
        # Device 101 (Trusted)
        # Merchant 201 (Paypal)
        self.graph.add_edge("U1", "D101")
        self.graph.add_edge("U1", "M201")
        
        # User 2 (Suspected Mule)
        # Device 102 (Risky)
        # Connected to Banned Node 666
        self.graph.add_node("U2", group=1)
        self.graph.add_node("B666", group=6, is_banned=True)
        self.graph.add_edge("U2", "D102")
        self.graph.add_edge("D102", "B666")

    def score(self, user_id: str, device_id: str) -> float:
        """
        Calculates a graph risk score based on proximity to banned nodes.
        """
        if user_id not in self.graph:
            return 10.0  # Unknown user base risk
        
        # Find shortest path to any banned node
        banned_nodes = [n for n, d in self.graph.nodes(data=True) if d.get("is_banned")]
        
        min_dist = float('inf')
        for bn in banned_nodes:
            try:
                dist = nx.shortest_path_length(self.graph, source=user_id, target=bn)
                min_dist = min(min_dist, dist)
            except nx.NetworkXNoPath:
                pass
        
        # Risk score based on distance (1 hop = high risk, 3+ = low risk)
        if min_dist == float('inf'): return 0.0
        if min_dist == 1: return 90.0
        if min_dist == 2: return 50.0
        return 15.0

    def get_topology(self, user_id: str):
        """
        Returns nodes and links for the UI force graph.
        """
        if user_id not in self.graph:
            return {"nodes": [{"id": user_id, "group": 1, "val": 25}], "links": []}
            
        nodes = []
        links = []
        
        # Get immediate neighborhood
        neighbors = list(self.graph.neighbors(user_id))
        nodes.append({"id": user_id, "group": 1, "val": 25})
        
        for n in neighbors:
            is_risk = self.graph.nodes[n].get("is_banned", False)
            nodes.append({"id": n, "group": 2, "val": 15, "is_risk": is_risk})
            links.append({"source": user_id, "target": n})
            
            # One more level deep for "context"
            for sn in self.graph.neighbors(n):
                if sn != user_id:
                    is_risk_s = self.graph.nodes[sn].get("is_banned", False)
                    nodes.append({"id": sn, "group": 3, "val": 10, "is_risk": is_risk_s})
                    links.append({"source": n, "target": sn})
        
        return {"nodes": nodes, "links": links}
