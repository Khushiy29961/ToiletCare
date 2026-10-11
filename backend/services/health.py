def calculate_health_score(water: bool, soap: bool, bin: int):
    """
    Calculate health score (0-100) and operational status.
    - Base score: 100
    - Water unavailable: -40
    - Soap unavailable: -20
    - Bin >= 90: -25
    - Bin >= 70: -15
    - Bin >= 50: -5
    """
    score = 100

    # Water is essential for toilet functionality
    if not water:
        score -= 40

    # Soap availability affects hygiene
    if not soap:
        score -= 20

    # Higher bin level means poorer condition
    if bin >= 90:
        score -= 25
    elif bin >= 70:
        score -= 15
    elif bin >= 50:
        score -= 5

    # Decide status from final score
    if score >= 70:
        status = "Healthy"
    elif score >= 40:
        status = "Attention"
    else:
        status = "Critical"

    return score, status


def determine_priority_and_action(water: bool, soap: bool, bin: int):
    """
    Determine issue priority and recommended action based on conditions.
    """
    if not water:
        return "Critical", "Restore water supply"

    if bin >= 90:
        return "High", "Empty waste bin"

    if not soap:
        return "Medium", "Refill soap"

    if bin >= 70:
        return "Low", "Monitor waste bin"

    return "Low", "No immediate action"
