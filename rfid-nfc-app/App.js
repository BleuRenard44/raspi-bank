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

  async function readUidFromCard() {
    try {
      await NfcManager.cancelTechnologyRequest();
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      return tag?.id || null;
    } catch (err) {
      Alert.alert("Erreur NFC", "Lecture UID échouée: " + err.message);
      return null;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

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

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const success = await writeNfc(code);
      if (!success) {
        setLoading(false);
        setMessageLocal("");
        return;
      }

      Alert.alert(
        "Succès",
        `Code "${code}" écrit sur la carte.\n\nRetirez puis remettez la carte pour la lecture.`
      );

      setMessageLocal("En attente de lecture...");

      try {
        await NfcManager.cancelTechnologyRequest();
        await new Promise((resolve) => setTimeout(resolve, 1500));

        await NfcManager.requestTechnology(NfcTech.Ndef);
        const tag = await NfcManager.getTag();

        if (!tag?.ndefMessage?.length) throw new Error("Aucun message trouvé");

        const payload = tag.ndefMessage[0].payload;
        const langLength = payload[0];
        const readCode = String.fromCharCode(...payload.slice(1 + langLength)).trim();

        if (!readCode || readCode.length !== 6) {
          throw new Error("Code NFC invalide : " + readCode);
        }

        const res = await fetch(`${apiBase}/accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rfid_uid: readCode,
            nom,
            prenom,
            adresse,
          }),
        });

        const json = await res.json();
        Alert.alert("Compte créé", `Code : ${readCode}\n${json.message || ""}`);
        fetchAccounts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      } finally {
        setLoading(false);
        setMessageLocal("");
        await NfcManager.cancelTechnologyRequest();
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Créer un compte</Text>
        <TextInput placeholder="Nom" style={styles.input} value={nom} onChangeText={setNom} editable={!loading} />
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
          <Text style={styles.buttonText}>{loading ? "En cours..." : "Approcher la carte pour écrire"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.message}>{messageLocal}</Text>
      </View>
    );
  }

  function ModalAddProduct({ onClose }) {
    const [nom, setNom] = useState("");
    const [prix, setPrix] = useState("");

    async function handleAdd() {
      if (!nom || !prix) return Alert.alert("Erreur", "Remplir tous les champs");
      try {
        await fetch(`${apiBase}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nom, prix: parseFloat(prix) }),
        });
        fetchProducts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Ajouter un produit</Text>
        <TextInput placeholder="Nom" style={styles.input} value={nom} onChangeText={setNom} />
        <TextInput
          placeholder="Prix (€)"
          style={styles.input}
          keyboardType="decimal-pad"
          value={prix}
          onChangeText={setPrix}
        />
        <TouchableOpacity style={styles.button} onPress={handleAdd}>
          <Text style={styles.buttonText}>Ajouter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function ModalMakePurchase({ onClose }) {
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [message, setMessage] = useState("");

    async function handlePurchase() {
      if (!selectedProductId) return Alert.alert("Erreur", "Sélectionner un produit");
      setMessage("Approcher carte...");
      const uid = await readUidFromCard();
      if (!uid) return;
      try {
        const res = await fetch(`${apiBase}/purchase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rfid_uid: uid, product_id: selectedProductId }),
        });
        const result = await res.json();
        Alert.alert("Achat", result.message || JSON.stringify(result));
        fetchAccounts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      } finally {
        setMessage("");
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Achat produit</Text>
        <ScrollView style={{ maxHeight: 250 }}>
          {products.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setSelectedProductId(p.id)}
              style={[styles.listItem, selectedProductId === p.id && styles.selectedItem]}
            >
              <Text>
                {p.nom} - {p.prix}€
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.button} onPress={handlePurchase}>
          <Text style={styles.buttonText}>Acheter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.message}>{message}</Text>
      </View>
    );
  }

  // Nouvelle ModalRechargeAccount en 3 étapes NFC pour recharge
  function ModalRechargeAccount({ onClose }) {
    const [step, setStep] = useState(1);
    const [uid, setUid] = useState(null);
    const [montant, setMontant] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function readCardUid() {
      setMessage("Approchez la carte NFC...");
      const cardUid = await readUidFromCard();
      if (cardUid) {
        setUid(cardUid);
        setMessage(`Carte détectée : ${cardUid}`);
        setStep(2);
      } else {
        setMessage("Lecture NFC échouée");
      }
    }

    async function confirmRecharge() {
      if (!montant || isNaN(parseFloat(montant)) || parseFloat(montant) <= 0) {
        return Alert.alert("Erreur", "Montant invalide");
      }
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/accounts/recharge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rfid_uid: uid, montant: parseFloat(montant) }),
        });
        const json = await res.json();
        Alert.alert("Rechargement", json.message || "Rechargement effectué");
        fetchAccounts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      } finally {
        setLoading(false);
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Recharger compte</Text>
        {step === 1 && (
          <>
            <TouchableOpacity style={styles.button} onPress={readCardUid}>
              <Text style={styles.buttonText}>Lire la carte NFC</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.buttonText}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.message}>{message}</Text>
          </>
        )}
        {step === 2 && (
          <>
            <Text>Carte : {uid}</Text>
            <TextInput
              placeholder="Montant à recharger"
              style={styles.input}
              keyboardType="decimal-pad"
              value={montant}
              onChangeText={setMontant}
              editable={!loading}
            />
            <TouchableOpacity style={styles.button} onPress={confirmRecharge} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? "Chargement..." : "Confirmer"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
              <Text style={styles.buttonText}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.message}>{message}</Text>
          </>
        )}
      </View>
    );
  }

  function renderModal() {
    if (!modalVisible || !modalContent) return null;

    const ModalComp = modalContent.component;
    return (
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackground}>
          <ModalComp onClose={() => setModalVisible(false)} />
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestion des Comptes</Text>
      <ScrollView style={{ flex: 1, width: "100%" }}>
        {accounts.length === 0 ? (
          <Text style={{ margin: 10 }}>Aucun compte trouvé.</Text>
        ) : (
          accounts.map((acc) => (
            <View key={acc.rfid_uid} style={styles.listItem}>
              <Text>
                {acc.nom} {acc.prenom} — Solde: {acc.solde?.toFixed(2) || "0"}€
              </Text>
            </View>
          ))
        )}

        <Text style={[styles.title, { marginTop: 20 }]}>Produits</Text>
        {products.length === 0 ? (
          <Text style={{ margin: 10 }}>Aucun produit trouvé.</Text>
        ) : (
          products.map((prod) => (
            <View key={prod.id} style={styles.listItem}>
              <Text>
                {prod.nom} — Prix: {prod.prix}€
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setModalContent({ component: ModalCreateAccount });
            setModalVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Créer un compte</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setModalContent({ component: ModalAddProduct });
            setModalVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Ajouter produit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setModalContent({ component: ModalMakePurchase });
            setModalVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Acheter</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setModalContent({ component: ModalRechargeAccount });
            setModalVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Recharger</Text>
        </TouchableOpacity>
      </View>

      {/* Affichage de la modale */}
      {renderModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#eee", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  listItem: {
    backgroundColor: "#fff",
    padding: 12,
    marginVertical: 6,
    borderRadius: 6,
    width: "100%",
    elevation: 2,
  },
  selectedItem: {
    backgroundColor: "#aaf",
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 12,
  },
  button: {
    backgroundColor: "#0275d8",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  buttonDisabled: {
    backgroundColor: "#888",
  },
  cancelButton: {
    backgroundColor: "#aaa",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16, textAlign: "center" },
  input: {
    backgroundColor: "#fff",
    marginVertical: 8,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 15 },
  message: { marginTop: 10, fontSize: 14, color: "gray", textAlign: "center" },
});
