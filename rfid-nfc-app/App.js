import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import NfcManager, { Ndef, NfcTech } from "react-native-nfc-manager";

// Initialise NFC
NfcManager.start();

export default function App() {
  const apiBase = "http://raspberrypi.local:8000";
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState(null);

  useEffect(() => {
    fetchAccounts();
    fetchProducts();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch(`${apiBase}/accounts`);
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("Erreur", "Chargement comptes : " + e.message);
    }
  }

  async function fetchProducts() {
    try {
      const res = await fetch(`${apiBase}/products`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("Erreur", "Chargement produits : " + e.message);
    }
  }

  async function writeNfc(text) {
    try {
      await NfcManager.cancelTechnologyRequest();
      await NfcManager.requestTechnology(NfcTech.Ndef);

      // Écriture NFC (attention erase n'existe pas dans certaines versions)
      const bytes = Ndef.encodeMessage([Ndef.textRecord(text)]);
      await NfcManager.ndefHandler.writeNdefMessage(bytes);

      await new Promise((resolve) => setTimeout(resolve, 600));
      return true;
    } catch (err) {
      console.error("❌ Erreur écriture NFC:", err);
      Alert.alert("Erreur NFC", err.toString());
      return false;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  // Modal création compte et écriture NFC
  function ModalCreateAccount({ onClose }) {
    const [nom, setNom] = useState("");
    const [prenom, setPrenom] = useState("");
    const [adresse, setAdresse] = useState("");
    const [loading, setLoading] = useState(false);
    const [messageLocal, setMessageLocal] = useState("");

    async function onWrite() {
      if (loading) return;
      if (!nom || !prenom || !adresse) {
        return Alert.alert("Erreur", "Veuillez remplir tous les champs");
      }

      setLoading(true);
      setMessageLocal("Approche la carte NFC...");

      const payload = JSON.stringify({ nom, prenom, adresse });
      const success = await writeNfc(payload);
      if (!success) {
        setLoading(false);
        setMessageLocal("");
        return;
      }

      Alert.alert("Succès", "Infos écrites sur la carte");
      const tag = await NfcManager.getTag();
      const uid = tag?.id;

      if (!uid) {
        Alert.alert("Erreur", "Impossible de lire l'UID");
        setLoading(false);
        setMessageLocal("");
        return;
      }

      try {
        // Enregistrement compte avec solde 0
        const res = await fetch(`${apiBase}/accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rfid_uid: uid, nom, prenom, adresse, solde: 0 }),
        });
        const json = await res.json();
        Alert.alert("Serveur", JSON.stringify(json));
        fetchAccounts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur serveur", e.message);
      } finally {
        setLoading(false);
        setMessageLocal("");
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Créer un compte</Text>
        <TextInput
          placeholder="Nom"
          style={styles.input}
          value={nom}
          onChangeText={setNom}
          editable={!loading}
        />
        <TextInput
          placeholder="Prénom"
          style={styles.input}
          value={prenom}
          onChangeText={setPrenom}
          editable={!loading}
        />
        <TextInput
          placeholder="Adresse"
          style={styles.input}
          value={adresse}
          onChangeText={setAdresse}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onWrite}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "En cours..." : "Approcher la carte pour écrire"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onClose}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.message}>{messageLocal}</Text>
      </View>
    );
  }

  // Modal recharge compte
  function ModalRecharge({ account, onClose, onReload }) {
    const [montant, setMontant] = useState("");
    const [loading, setLoading] = useState(false);

    async function onRecharge() {
      const val = parseFloat(montant);
      if (isNaN(val) || val <= 0) {
        return Alert.alert("Erreur", "Entrez un montant valide");
      }
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/accounts/${account.rfid_uid}/recharge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ montant: val }),
        });
        if (!res.ok) throw new Error("Erreur serveur");
        Alert.alert("Succès", "Compte rechargé");
        onReload();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      } finally {
        setLoading(false);
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Recharger compte de {account.nom}</Text>
        <Text>Solde actuel: {account.solde}€</Text>
        <TextInput
          placeholder="Montant à recharger"
          keyboardType="numeric"
          style={styles.input}
          value={montant}
          onChangeText={setMontant}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onRecharge}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "En cours..." : "Recharger"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onClose}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Modal achat produit
  function ModalAchat({ account, products, onClose, onReload }) {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [loading, setLoading] = useState(false);

    async function onBuy() {
      if (!selectedProduct) return Alert.alert("Erreur", "Choisissez un produit");
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/accounts/${account.rfid_uid}/buy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: selectedProduct.id }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.message || "Erreur lors de l'achat");
        }
        Alert.alert("Succès", "Achat effectué");
        onReload();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      } finally {
        setLoading(false);
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Acheter un produit</Text>
        <ScrollView style={{ maxHeight: 200, marginBottom: 15 }}>
          {products.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.listItem,
                selectedProduct?.id === p.id && styles.selectedItem,
              ]}
              onPress={() => setSelectedProduct(p)}
              disabled={loading}
            >
              <Text>
                {p.nom} - {p.prix}€
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onBuy}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "En cours..." : "Acheter"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onClose}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function openModal(content) {
    setModalContent(content);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setModalContent(null);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Banque RFID</Text>
      <TouchableOpacity
        style={styles.mainButton}
        onPress={() => openModal(<ModalCreateAccount onClose={closeModal} />)}
      >
        <Text style={styles.mainButtonText}>Créer un compte</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>{modalContent}</View>
        </View>
      </Modal>

      <ScrollView style={{ marginTop: 20 }}>
        <Text style={styles.sectionTitle}>Comptes</Text>
        {accounts.length === 0 ? (
          <Text style={styles.emptyText}>Aucun compte</Text>
        ) : (
          accounts.map((acc) => (
            <View key={acc.rfid_uid} style={styles.listItem}>
              <Text>
                {acc.nom} {acc.prenom} (UID: {acc.rfid_uid}) - Solde: {acc.solde}€
              </Text>
              <View style={{ flexDirection: "row", marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.button, { flex: 1, marginRight: 5 }]}
                  onPress={() =>
                    openModal(
                      <ModalRecharge
                        account={acc}
                        onClose={closeModal}
                        onReload={fetchAccounts}
                      />
                    )
                  }
                >
                  <Text style={styles.buttonText}>Recharger</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, { flex: 1, backgroundColor: "#28a745" }]}
                  onPress={() =>
                    openModal(
                      <ModalAchat
                        account={acc}
                        products={products}
                        onClose={closeModal}
                        onReload={fetchAccounts}
                      />
                    )
                  }
                >
                  <Text style={styles.buttonText}>Acheter</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f0f4f7" },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  mainButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: "center",
  },
  mainButtonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  sectionTitle: { fontSize: 22, fontWeight: "600", marginVertical: 15, color: "#444" },
  listItem: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  emptyText: { textAlign: "center", color: "#666", fontStyle: "italic" },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  modalContent: {},
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    color: "#222",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#a0cfff",
  },
  cancelButton: {
    backgroundColor: "#ff3b30",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  selectedItem: {
    backgroundColor: "#d0eaff",
  },
  message: {
    textAlign: "center",
    marginTop: 10,
    color: "#007AFF",
    fontWeight: "600",
  },
});
